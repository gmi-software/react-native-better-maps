package com.margelo.nitro.nitromaps

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import com.margelo.nitro.nitromaps.views.HybridMapViewManager

/**
 * React Native package that registers the `MapView` Nitro HybridView's view
 * manager and loads the native NitroMaps C++ library.
 */
class NitroMapsPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? {
    return null
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider { HashMap() }
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return listOf(HybridMapViewManager())
  }

  companion object {
    init {
      System.loadLibrary("NitroMaps")
    }
  }
}
