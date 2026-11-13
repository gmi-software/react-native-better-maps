package com.margelo.nitro.nitromaps

/**
 * Parses a hex color string into an Android color int.
 * Supports `#RGB`, `#RGBA`, `#RRGGBB`, and `#RRGGBBAA`.
 */
fun String.toColorInt(fallback: Int = 0xFF000000.toInt()): Int = toColorIntOrNull() ?: fallback

/** The color int this hex string parses to, or `null` when it does not parse. */
fun String.toColorIntOrNull(): Int? {
  val digits = trim().removePrefix("#")

  val expanded =
    when (digits.length) {
      3, 4 -> digits.map { "$it$it" }.joinToString("")
      6, 8 -> digits
      else -> return null
    }

  val rgba = if (expanded.length == 6) "${expanded}FF" else expanded
  if (!rgba.all { it.digitToIntOrNull(16) != null }) {
    return null
  }

  val value = rgba.toLong(16)

  val alpha = (value and 0xFF).toInt()
  val red = ((value shr 24) and 0xFF).toInt()
  val green = ((value shr 16) and 0xFF).toInt()
  val blue = ((value shr 8) and 0xFF).toInt()

  return (alpha shl 24) or (red shl 16) or (green shl 8) or blue
}
