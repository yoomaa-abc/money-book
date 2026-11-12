#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
: "${JAVA_HOME:?Set JAVA_HOME to JDK 21}"
: "${ANDROID_JAR:?Set ANDROID_JAR to Android API 35 android.jar}"
: "${ANDROID_BUILD_TOOLS:?Set ANDROID_BUILD_TOOLS to Build Tools 35.0.0}"
: "${ANDROID_KEYSTORE:?Set ANDROID_KEYSTORE to the original signing key file}"
: "${ANDROID_KEYSTORE_PASSWORD:?Set ANDROID_KEYSTORE_PASSWORD privately}"
export PATH="$JAVA_HOME/bin:$PATH"
build_dir="$project_dir/build"
output="${1:-$build_dir/salimgyeol-1.3.3.apk}"
mkdir -p "$build_dir" "$(dirname -- "$output")"
# Use fresh intermediate directories so deleted classes cannot remain in the APK.
rm -rf -- "$build_dir/classes" "$build_dir/dex"
mkdir -p "$build_dir/classes" "$build_dir/dex"
"$ANDROID_BUILD_TOOLS/aapt2" compile --dir "$project_dir/res" -o "$build_dir/resources.zip"
"$ANDROID_BUILD_TOOLS/aapt2" link -o "$build_dir/base.apk" --manifest "$project_dir/AndroidManifest.xml" -I "$ANDROID_JAR" -A "$project_dir/assets" --auto-add-overlay "$build_dir/resources.zip"
mapfile -d '' sources < <(find "$project_dir/src" -name '*.java' -print0)
javac -encoding UTF-8 --release 8 -classpath "$ANDROID_JAR" -d "$build_dir/classes" "${sources[@]}"
jar cf "$build_dir/classes.jar" -C "$build_dir/classes" .
"$ANDROID_BUILD_TOOLS/d8" --min-api 26 --lib "$ANDROID_JAR" --output "$build_dir/dex" "$build_dir/classes.jar"
cp "$build_dir/base.apk" "$build_dir/unsigned.apk"
jar uf "$build_dir/unsigned.apk" -C "$build_dir/dex" classes.dex
"$ANDROID_BUILD_TOOLS/zipalign" -f -p 4 "$build_dir/unsigned.apk" "$build_dir/aligned.apk"
"$ANDROID_BUILD_TOOLS/apksigner" sign --ks "$ANDROID_KEYSTORE" --ks-pass env:ANDROID_KEYSTORE_PASSWORD --key-pass env:ANDROID_KEYSTORE_PASSWORD --ks-key-alias dalsseum --out "$output" "$build_dir/aligned.apk"
"$ANDROID_BUILD_TOOLS/apksigner" verify --verbose "$output"
"$ANDROID_BUILD_TOOLS/zipalign" -c -p 4 "$output"
printf 'Built: %s\n' "$output"
