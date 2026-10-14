package com.margelo.nitro.nitromaps

import android.content.Context
import android.content.pm.ApplicationInfo

/** Whether the host app was built debuggable, as debug builds are and release builds are not. */
internal val Context.isDebuggable: Boolean
  get() = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
