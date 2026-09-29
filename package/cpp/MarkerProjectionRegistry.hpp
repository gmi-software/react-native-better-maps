#pragma once

#include <react/renderer/graphics/Point.h>

namespace margelo::nitro::nitromaps {

// Fabric can measure on a thread other than the platform UI thread. Store only
// projected coordinates here; never read UIKit or Android Views from a shadow node.
void publishMarkerProjection(int tag, float x, float y);
void clearMarkerProjection(int tag);
facebook::react::Point markerProjection(int tag);

} // namespace margelo::nitro::nitromaps
