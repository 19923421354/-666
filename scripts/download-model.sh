#!/usr/bin/env bash
# 下载并转换「星语 AI」内置模型（Qwen2.5-0.5B-Instruct）
# 流程：原始权重 -> fp32 ONNX -> fp16 存储（fp16 权重 + fp32 计算）
# 产物放入 web/public/models/Qwen2.5-0.5B-Instruct/onnx/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/web/public/models/Qwen2.5-0.5B-Instruct"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

MODEL_ID="Qwen/Qwen2.5-0.5B-Instruct"
BASE="https://modelscope.cn/models/$MODEL_ID/resolve/master"

echo "[1/4] 下载原始权重 -> $TMP"
mkdir -p "$TMP"
for f in config.json generation_config.json tokenizer.json tokenizer_config.json vocab.json merges.txt model.safetensors; do
  echo "  $f"
  curl -L --retry 3 -o "$TMP/$f" "$BASE/$f"
done

echo "[2/4] 导出 fp32 ONNX（text-generation-with-past）"
python -m pip install -q "optimum[onnxruntime]" torch
optimum-cli export onnx -m "$TMP" --task text-generation-with-past --no-constant-folding "$TMP/onnx"

echo "[3/4] 流式转 fp16 存储（逐张量转换，内存安全）"
python - "$TMP/onnx" <<'PY'
import os, sys
import numpy as np
import onnx
from onnx import TensorProto, helper, StringStringEntryProto

src_dir = sys.argv[1]
model = onnx.load(os.path.join(src_dir, 'model.onnx'), load_external_data=False)
graph = model.graph
data_path = os.path.join(src_dir, 'model_fp16.onnx_data')

def get_ext(it):
    loc = off = length = None
    for ed in it.external_data:
        if ed.key == 'location': loc = ed.value
        elif ed.key == 'offset': off = int(ed.value)
        elif ed.key == 'length': length = int(ed.value)
    return loc, off, length

src_f = open(os.path.join(src_dir, 'model.onnx_data'), 'rb')
dst_f = open(data_path, 'wb')

def read_bytes(it):
    if it.raw_data:
        return bytes(it.raw_data)
    _, off, length = get_ext(it)
    src_f.seek(off)
    return src_f.read(length)

def write_bytes(data):
    dst_f.write(data)
    return dst_f.tell() - len(data)

def set_ext(it, offset, length):
    del it.external_data[:]
    it.external_data.append(StringStringEntryProto(key='location', value=os.path.basename(data_path)))
    it.external_data.append(StringStringEntryProto(key='offset', value=str(offset)))
    it.external_data.append(StringStringEntryProto(key='length', value=str(length)))
    it.ClearField('raw_data')

fp16_weights = set()
for it in graph.initializer:
    loc, _, _ = get_ext(it)
    if it.data_type == TensorProto.FLOAT and len(it.dims) > 0 and (it.raw_data or get_ext(it)[1] is not None):
        if int(np.prod(list(it.dims))) >= 1024:
            raw = read_bytes(it)
            arr16 = np.frombuffer(raw, dtype=np.float32).reshape(list(it.dims)).astype(np.float16)
            off = write_bytes(arr16.tobytes())
            it.data_type = TensorProto.FLOAT16
            set_ext(it, off, arr16.nbytes)
            fp16_weights.add(it.name)
        else:
            if loc is not None:
                raw = read_bytes(it)
                off = write_bytes(raw)
                set_ext(it, off, len(raw))
    elif loc is not None:
        raw = read_bytes(it)
        off = write_bytes(raw)
        set_ext(it, off, len(raw))

cast_nodes = []
for node in graph.node:
    for i, inp in enumerate(node.input):
        if inp in fp16_weights:
            new_name = inp + '_f32'
            node.input[i] = new_name
            cast_nodes.append(helper.make_node('Cast', [inp], [new_name], inp + '_cast', to=1))
            graph.value_info.append(helper.make_tensor_value_info(new_name, TensorProto.FLOAT, None))
graph.node.extend(cast_nodes)

src_f.close()
dst_f.close()
with open(os.path.join(src_dir, 'model_fp16.onnx'), 'wb') as f:
    f.write(model.SerializeToString())
print('fp16 stored:', os.path.getsize(data_path), 'bytes')
PY

echo "[4/4] 复制到 $DEST"
mkdir -p "$DEST/onnx"
for f in config.json generation_config.json tokenizer.json tokenizer_config.json vocab.json merges.txt; do
  cp "$TMP/$f" "$DEST/$f"
done
cp "$TMP/onnx/model_fp16.onnx" "$DEST/onnx/model_fp16.onnx"
cp "$TMP/onnx/model_fp16.onnx_data" "$DEST/onnx/model_fp16.onnx_data"
ls -lh "$DEST/onnx"
echo "完成：模型已就位，可重新构建 Web/APK。"
