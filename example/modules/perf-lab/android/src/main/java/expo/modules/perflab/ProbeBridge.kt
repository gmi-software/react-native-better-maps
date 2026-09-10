package expo.modules.perflab

/**
 * Reaches `NitroMapsPerfProbeBridge` inside react-native-better-maps through
 * reflection so this module does not depend on the library's Gradle module.
 */
internal object ProbeBridge {
  private const val CLASS_NAME = "com.margelo.nitro.nitromaps.NitroMapsPerfProbeBridge"

  private val bridge: Class<*>? = try {
    Class.forName(CLASS_NAME)
  } catch (_: ClassNotFoundException) {
    null
  }

  fun isAvailable(): Boolean =
    bridge?.getMethod("isAvailable")?.invoke(null) as? Boolean ?: false

  fun setEnabled(enabled: Boolean) {
    bridge?.getMethod("setEnabled", Boolean::class.javaPrimitiveType)?.invoke(null, enabled)
  }

  fun drainJson(): String =
    bridge?.getMethod("drainJson")?.invoke(null) as? String ?: "{\"spans\":[],\"dropped\":0}"
}
