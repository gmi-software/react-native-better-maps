#include <jni.h>
#include <fbjni/fbjni.h>
#include "NitroMapsOnLoad.hpp"
#include "MarkerProjectionRegistry.hpp"

extern "C" JNIEXPORT void JNICALL
Java_com_margelo_nitro_nitromaps_MarkerProjectionRegistry_publish(
    JNIEnv*, jclass, jint tag, jfloat x, jfloat y) {
  margelo::nitro::nitromaps::publishMarkerProjection(tag, x, y);
}

extern "C" JNIEXPORT void JNICALL
Java_com_margelo_nitro_nitromaps_MarkerProjectionRegistry_clear(
    JNIEnv*, jclass, jint tag) {
  margelo::nitro::nitromaps::clearMarkerProjection(tag);
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::nitromaps::registerAllNatives();
  });
}
