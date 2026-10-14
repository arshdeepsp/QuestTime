const fs = require("fs");
const path = require("path");

const pkg = "com.arsh.productivitycraft";
if (!fs.existsSync("android")) {
  console.error("No android/ folder. Run: npx cap add android");
  process.exit(1);
}

const javaDir = path.join("android", "app", "src", "main", "java", ...pkg.split("."));
const resDir = path.join("android", "app", "src", "main", "res", "drawable");
const layoutDir = path.join("android", "app", "src", "main", "res", "layout");
fs.mkdirSync(javaDir, { recursive: true });
fs.mkdirSync(resDir, { recursive: true });
fs.mkdirSync(layoutDir, { recursive: true });

for (const f of ["FocusNotifyPlugin.java", "FocusNotifier.java", "FocusNotifyReceiver.java"]) {
  fs.copyFileSync(path.join("native", "android", f), path.join(javaDir, f));
}
fs.copyFileSync(path.join("native", "android", "ic_stat_focus.xml"), path.join(resDir, "ic_stat_focus.xml"));
fs.copyFileSync(path.join("native", "android", "notif_focus.xml"), path.join(layoutDir, "notif_focus.xml"));
fs.copyFileSync(path.join("native", "android", "notif_focus_small.xml"), path.join(layoutDir, "notif_focus_small.xml"));
const rawDir = path.join("android", "app", "src", "main", "res", "raw");
fs.mkdirSync(rawDir, { recursive: true });
fs.copyFileSync(path.join("native", "android", "pc_chime.wav"), path.join(rawDir, "pc_chime.wav"));
fs.copyFileSync(path.join("native", "android", "pc_stop.wav"), path.join(rawDir, "pc_stop.wav"));
fs.copyFileSync(path.join("native", "android", "pc_squish.wav"), path.join(rawDir, "pc_squish.wav"));

fs.writeFileSync(path.join(javaDir, "MainActivity.java"), `package ${pkg};

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FocusNotifyPlugin.class);
        super.onCreate(savedInstanceState);
        FocusNotifyPlugin.capture(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        FocusNotifyPlugin.capture(intent);
    }
}
`);

const manifestPath = path.join("android", "app", "src", "main", "AndroidManifest.xml");
let manifest = fs.readFileSync(manifestPath, "utf8");
if (!manifest.includes("FocusNotifyReceiver")) {
  manifest = manifest.replace("</application>", '    <receiver android:name=".FocusNotifyReceiver" android:exported="false" />\n    </application>');
  fs.writeFileSync(manifestPath, manifest);
}

fs.writeFileSync(path.join(resDir, "pc_splash_blank.xml"), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@android:color/transparent" />
    <size android:width="1dp" android:height="1dp" />
</shape>
`);
const stylesPath = path.join("android", "app", "src", "main", "res", "values", "styles.xml");
let styles = fs.readFileSync(stylesPath, "utf8");
styles = styles.replace(/<style name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/, `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">#212121</item>
        <item name="windowSplashScreenBackground">#212121</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/pc_splash_blank</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`);
fs.writeFileSync(stylesPath, styles);
const appName = JSON.parse(fs.readFileSync("capacitor.config.json", "utf8")).appName;
const stringsPath = path.join("android", "app", "src", "main", "res", "values", "strings.xml");
fs.writeFileSync(
  stringsPath,
  fs
    .readFileSync(stringsPath, "utf8")
    .replace(/(<string name="(?:app_name|title_activity_main)">)[^<]*(<\/string>)/g, `$1${appName}$2`),
);

console.log("Native focus timer plugin, plain launch screen and app name added to android/");
