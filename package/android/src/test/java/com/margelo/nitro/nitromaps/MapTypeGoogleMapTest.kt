package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.GoogleMap
import org.junit.Assert.assertEquals
import org.junit.Test

class MapTypeGoogleMapTest {
  @Test
  fun fallsBackToTheNormalMapForMutedStandard() {
    assertEquals(GoogleMap.MAP_TYPE_NORMAL, MapType.MUTEDSTANDARD.toGoogleMapType())
  }

  @Test
  fun mapsEveryOtherTypeToItsGoogleCounterpart() {
    assertEquals(GoogleMap.MAP_TYPE_NORMAL, MapType.STANDARD.toGoogleMapType())
    assertEquals(GoogleMap.MAP_TYPE_SATELLITE, MapType.SATELLITE.toGoogleMapType())
    assertEquals(GoogleMap.MAP_TYPE_HYBRID, MapType.HYBRID.toGoogleMapType())
    assertEquals(GoogleMap.MAP_TYPE_TERRAIN, MapType.TERRAIN.toGoogleMapType())
  }
}
