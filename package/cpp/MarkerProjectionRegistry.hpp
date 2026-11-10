#pragma once

#include <react/renderer/graphics/Point.h>

namespace margelo::nitro::nitromaps {

// Where each live marker host is translated to, in points, by Fabric tag.
//
// The native host writes on the UI thread whenever the camera moves it. Fabric
// reads while measuring, which can happen on another thread, so a shadow node
// must read here and never touch a UIView or an Android View.
void publishMarkerProjection(int tag, float x, float y);
void clearMarkerProjection(int tag);
facebook::react::Point markerProjection(int tag);

} // namespace margelo::nitro::nitromaps
