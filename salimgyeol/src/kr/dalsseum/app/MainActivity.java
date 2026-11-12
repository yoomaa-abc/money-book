package kr.dalsseum.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.content.Intent;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.graphics.Color;
import android.view.View;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.os.Build;
import android.graphics.Insets;
import android.window.OnBackInvokedDispatcher;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends Activity {
 private WebView web;
 private FrameLayout content;
 private AlertDialog exitDialog;
 private boolean pageReady=false;
 private String pendingScript;
 private void evaluateWhenReady(String script){if(pageReady)web.evaluateJavascript(script,null);else pendingScript=script;}
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
  getWindow().setStatusBarColor(Color.rgb(246,248,244));
  getWindow().setNavigationBarColor(Color.rgb(246,248,244));
  getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
  web = new WebView(this);
  web.setBackgroundColor(Color.rgb(246,248,244));
  web.getSettings().setJavaScriptEnabled(true);
  web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setAllowFileAccess(false);
  web.getSettings().setAllowContentAccess(false);
  web.setWebViewClient(new WebViewClient(){
   @Override public void onPageFinished(WebView v,String url){pageReady=true;if(pendingScript!=null){v.evaluateJavascript(pendingScript,null);pendingScript=null;}}
   @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r){ return true; }
   @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r){
    if (!"app.dalsseum.local".equals(r.getUrl().getHost())) return new android.webkit.WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
    try {
     String path = r.getUrl().getPath();
     if(path==null || path.contains("..")) throw new IOException();
     String file = path.equals("/") ? "index.html" : path.substring(1);
     String type = file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/html";
     return new android.webkit.WebResourceResponse(type,"UTF-8",getAssets().open(file));
    } catch(IOException e) { return new android.webkit.WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0])); }
   }
  });
  web.addJavascriptInterface(new Bridge(),"Dalsseum");
  content=new FrameLayout(this);
  content.setBackgroundColor(Color.rgb(246,248,244));
  content.addView(web,new FrameLayout.LayoutParams(-1,-1));
  setContentView(content);
  // Resize the WebView itself above the IME; consume handled insets to avoid double padding.
  content.setOnApplyWindowInsetsListener((v,insets)->{
   if(Build.VERSION.SDK_INT>=30){
    int types=WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime();
    Insets safe=insets.getInsets(types);
    v.setPadding(safe.left,safe.top,safe.right,safe.bottom);
    return new WindowInsets.Builder(insets).setInsets(types,Insets.NONE).build();
   }
   // Older Android uses the window's adjustResize behavior for the keyboard.
   return insets;
  });
  content.requestApplyInsets();
  if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->requestBack());
  web.loadUrl("https://app.dalsseum.local/");
 }
 public class Bridge {
  @JavascriptInterface public String read(){return getPreferences(MODE_PRIVATE).getString("ledger","");}
  @JavascriptInterface public boolean write(String value){return getPreferences(MODE_PRIVATE).edit().putString("ledger",value).commit();}
  @JavascriptInterface public String storageInfo(){return "휴대폰 내부 저장 · 앱 전용 영역 · 오프라인 사용";}
  @JavascriptInterface public boolean checkStorage(){String token=Long.toString(System.nanoTime());android.content.SharedPreferences prefs=getPreferences(MODE_PRIVATE);boolean saved=prefs.edit().putString("storageProbe",token).commit();boolean ok=saved&&token.equals(prefs.getString("storageProbe",""));prefs.edit().remove("storageProbe").commit();return ok;}
  @JavascriptInterface public void backup(String value){runOnUiThread(()->{try{try(FileOutputStream out=new FileOutputStream(new File(getCacheDir(),"pending-backup.json"))){out.write(value.getBytes(StandardCharsets.UTF_8));}Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.setType("application/json");i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_TITLE,"dalsseum-backup-"+new java.text.SimpleDateFormat("yyyyMMdd-HHmmss",java.util.Locale.US).format(new java.util.Date())+".json");startActivityForResult(i,10);}catch(Exception e){evaluateWhenReady("toast('백업을 시작하지 못했어요. 저장 공간을 확인해 주세요.')");}});}
  @JavascriptInterface public void restore(){runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(i,11);});}
 }
 @Override protected void onActivityResult(int req,int result,Intent data){
  super.onActivityResult(req,result,data);
  if(result!=RESULT_OK || data==null || data.getData()==null) {if(req==10)new File(getCacheDir(),"pending-backup.json").delete();return;}
  try {
   if(req==10){File file=new File(getCacheDir(),"pending-backup.json");try(InputStream in=new FileInputStream(file);OutputStream out=getContentResolver().openOutputStream(data.getData())){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);}file.delete();evaluateWhenReady("toast('백업 파일을 저장했어요')");}
   if(req==11){try(InputStream in=getContentResolver().openInputStream(data.getData()); ByteArrayOutputStream out=new ByteArrayOutputStream()){
    byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){out.write(buffer,0,n);if(out.size()>50*1024*1024)throw new IOException("파일이 너무 큽니다");}
    String value=new String(out.toByteArray(),StandardCharsets.UTF_8);
    evaluateWhenReady("receiveBackup("+JSONObject.quote(value)+")");
   }}
  }catch(Exception e){new AlertDialog.Builder(this).setMessage("파일을 처리하지 못했어요. 파일 권한과 저장 공간을 확인해 주세요.").setPositiveButton("확인",null).show();}
 }
 private void confirmExit(){
  if(exitDialog!=null&&exitDialog.isShowing())return;
  exitDialog=new AlertDialog.Builder(this).setTitle("앱 종료").setMessage("살림결을 종료할까요? 저장한 내역은 휴대폰에 보관됩니다.").setPositiveButton("종료",(d,w)->finish()).setNegativeButton("취소",null).create();
  exitDialog.show();
 }
 private void requestBack(){
  if(Build.VERSION.SDK_INT>=30){WindowInsets insets=web.getRootWindowInsets();if(insets!=null&&insets.isVisible(WindowInsets.Type.ime())){if(web.getWindowInsetsController()!=null)web.getWindowInsetsController().hide(WindowInsets.Type.ime());return;}}
  if(!pageReady){confirmExit();return;}
  web.evaluateJavascript("handleBack()",result->{if(!"true".equals(result))confirmExit();});
 }
 @Override public void onBackPressed(){requestBack();}
}
