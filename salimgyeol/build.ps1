param(
 [Parameter(Mandatory=$true)][string]$JavaHome,
 [Parameter(Mandatory=$true)][string]$BuildTools,
 [Parameter(Mandatory=$true)][string]$AndroidJar,
 [string]$Output = "$PSScriptRoot/build/salimgyeol-1.3.1.apk"
)
$ErrorActionPreference='Stop'
$env:JAVA_HOME=$JavaHome
$env:PATH="$JavaHome/bin;"+$env:PATH
$BuildTools=(Resolve-Path $BuildTools).Path
$AndroidJar=(Resolve-Path $AndroidJar).Path
$taskBuild="$PSScriptRoot/build"
New-Item -ItemType Directory -Force "$taskBuild/classes","$taskBuild/dex" | Out-Null
function Check-Native { if($LASTEXITCODE -ne 0){throw "Build tool failed: $LASTEXITCODE"} }
& "$BuildTools/aapt2.exe" compile --dir "$PSScriptRoot/res" -o "$taskBuild/resources.zip"
Check-Native
& "$BuildTools/aapt2.exe" link -o "$taskBuild/base.apk" --manifest "$PSScriptRoot/AndroidManifest.xml" -I $AndroidJar -A "$PSScriptRoot/assets" --auto-add-overlay "$taskBuild/resources.zip"
Check-Native
$sources=Get-ChildItem "$PSScriptRoot/src" -Recurse -Filter *.java | ForEach-Object FullName
& "$JavaHome/bin/javac.exe" -encoding UTF-8 --release 8 -classpath $AndroidJar -d "$taskBuild/classes" $sources
Check-Native
& "$JavaHome/bin/jar.exe" "-J-Djava.io.tmpdir=$taskBuild" cf "$taskBuild/classes.jar" -C "$taskBuild/classes" .
Check-Native
& "$BuildTools/d8.bat" --min-api 26 --lib $AndroidJar --output "$taskBuild/dex" "$taskBuild/classes.jar"
Check-Native
Copy-Item "$taskBuild/base.apk" "$taskBuild/unsigned.apk" -Force
& "$JavaHome/bin/jar.exe" "-J-Djava.io.tmpdir=$taskBuild" uf "$taskBuild/unsigned.apk" -C "$taskBuild/dex" classes.dex
Check-Native
& "$BuildTools/zipalign.exe" -f -p 4 "$taskBuild/unsigned.apk" "$taskBuild/aligned.apk"
Check-Native
$key="$PSScriptRoot/dalsseum-signing.p12"
if(!(Test-Path $key)){
 & "$JavaHome/bin/keytool.exe" -genkeypair -keystore $key -storetype PKCS12 -storepass $env:ANDROID_KEYSTORE_PASSWORD -keypass $env:ANDROID_KEYSTORE_PASSWORD -alias dalsseum -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Dalsseum, OU=Personal App, O=Dalsseum, C=KR'
 Check-Native
}
New-Item -ItemType Directory -Force (Split-Path $Output) | Out-Null
& "$BuildTools/apksigner.bat" sign --ks $key --ks-pass pass:ANDROID_KEYSTORE_PASSWORD (set privately) --key-pass pass:ANDROID_KEYSTORE_PASSWORD (set privately) --ks-key-alias dalsseum --out $Output "$taskBuild/aligned.apk"
Check-Native
& "$BuildTools/apksigner.bat" verify --verbose $Output
Check-Native
Write-Output "Built: $Output"
