package com.margelo.nitro.nitromaps

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat

internal val Context.hasFineLocationPermission: Boolean
  get() = isPermissionGranted(Manifest.permission.ACCESS_FINE_LOCATION)

internal val Context.hasCoarseLocationPermission: Boolean
  get() = isPermissionGranted(Manifest.permission.ACCESS_COARSE_LOCATION)

private fun Context.isPermissionGranted(permission: String): Boolean =
  ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
