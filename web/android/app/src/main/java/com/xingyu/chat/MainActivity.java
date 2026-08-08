package com.xingyu.chat;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;

// 应用内更新：提供 downloadAndInstall(url) 给前端调用，
// 通过系统 DownloadManager 下载 APK 并调用系统安装器，全程不跳出应用外链接。
public class MainActivity extends BridgeActivity {

    private static final String TAG = "XingyuUpdater";
    private static final String FILE_PROVIDER_AUTHORITY = "com.xingyu.chat.fileprovider";

    private long lastDownloadId = -1;
    private File pendingApk = null;

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (id != lastDownloadId || pendingApk == null) return;
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            try {
                DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
                try (Cursor c = dm.query(query)) {
                    if (c != null && c.moveToFirst()) {
                        int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                        if (status == DownloadManager.STATUS_SUCCESSFUL) {
                            if (pendingApk.exists() && pendingApk.length() > 1000000) {
                                installApk(pendingApk);
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "query download failed", e);
            }
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        } catch (Exception e) {
            Log.e(TAG, "register receiver failed", e);
        }
        try {
            getBridge().getWebView().addJavascriptInterface(this, "XingyuUpdater");
        } catch (Exception e) {
            Log.e(TAG, "add js bridge failed", e);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            unregisterReceiver(downloadReceiver);
        } catch (Exception e) {
            // ignore
        }
    }

    @JavascriptInterface
    public void downloadAndInstall(String url) {
        if (url == null || url.isEmpty()) return;
        try {
            File dir = new File(getCacheDir(), "updates");
            if (!dir.exists()) dir.mkdirs();
            File target = new File(dir, "xingyu-latest.apk");
            if (target.exists() && !target.delete()) {
                // 删除失败则换名，避免占用冲突
                target = new File(dir, "xingyu-latest-" + System.currentTimeMillis() + ".apk");
            }

            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setTitle("星语 AI 更新");
            req.setDescription("正在下载新版本安装包");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationUri(Uri.fromFile(target));
            req.setAllowedOverMetered(true);
            req.setAllowedOverRoaming(true);

            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            lastDownloadId = dm.enqueue(req);
            pendingApk = target;
        } catch (Exception e) {
            Log.e(TAG, "download failed", e);
        }
    }

    private void installApk(File file) {
        try {
            Uri uri = FileProvider.getUriForFile(this, FILE_PROVIDER_AUTHORITY, file);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "install failed", e);
        }
    }
}
