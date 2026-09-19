package com.app.m3expressive

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream

/**
 * 课表数据：导入、解析与本地保存。
 *
 * Android 侧通过 SAF（系统内置文件选择器，`ActivityResultContracts.OpenDocument`）
 * 选取文件，这里负责识别格式（教务系统的 RTF/DOC、另存为的 HTML 表格、CSV/文本），
 * 解析成 [Schedule]，并保存到 SharedPreferences（导入后覆盖内置课表）。
 */
data class Schedule(
    val owner: String,
    val term: String,
    val termStart: String,
    val days: List<String>,
    val periods: List<SchedulePeriod>,
    val imported: Boolean = false,
) {
    val courseCount: Int
        get() = periods.sumOf { period -> period.days.sumOf { it.size } }
}

object ScheduleCodec {

    private const val PREFS = "m3expressive"
    private const val KEY = "imported_schedule"

    /** 内置课表（由 scripts/import-schedule.mjs 生成）。 */
    val builtIn: Schedule = Schedule(
        owner = EmbeddedSchedule.OWNER,
        term = EmbeddedSchedule.TERM,
        termStart = EmbeddedSchedule.TERM_START,
        days = EmbeddedSchedule.days,
        periods = EmbeddedSchedule.periods,
        imported = false,
    )

    /** 当前生效的课表：导入过就用导入的，否则用内置的。 */
    fun current(context: Context): Schedule {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return builtIn
        return runCatching { fromJson(JSONObject(raw)) }.getOrNull() ?: builtIn
    }

    fun save(context: Context, schedule: Schedule) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY, toJson(schedule).toString())
            .apply()
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply()
    }

    /** 从系统文件选择器返回的 Uri 读取并解析课表。 */
    fun parse(context: Context, input: InputStream, displayName: String): Schedule {
        val bytes = input.readBytes()
        val name = displayName.lowercase()
        val text = String(bytes, Charsets.UTF_8)
        return when {
            name.endsWith(".rtf") || name.endsWith(".doc") || text.startsWith("{\\rtf") -> parseRtf(text)
            name.endsWith(".html") || name.endsWith(".htm") || text.contains("<table", ignoreCase = true) -> parseHtml(text)
            else -> parseText(text)
        }
    }

    /* ------------------------------------------------------------ JSON ------ */

    private fun toJson(schedule: Schedule): JSONObject = JSONObject().apply {
        put("owner", schedule.owner)
        put("term", schedule.term)
        put("termStart", schedule.termStart)
        put("days", JSONArray(schedule.days))
        put(
            "periods",
            JSONArray().apply {
                schedule.periods.forEach { period ->
                    put(
                        JSONObject().apply {
                            put("period", period.period)
                            put("time", period.time)
                            put("section", period.section)
                            put(
                                "days",
                                JSONArray().apply {
                                    period.days.forEach { day ->
                                        put(
                                            JSONArray().apply {
                                                day.forEach { course ->
                                                    put(
                                                        JSONObject().apply {
                                                            put("name", course.name)
                                                            put("weeks", course.weeks)
                                                            put("teacher", course.teacher)
                                                            put("room", course.room)
                                                        },
                                                    )
                                                }
                                            },
                                        )
                                    }
                                },
                            )
                        },
                    )
                }
            },
        )
    }

    private fun fromJson(json: JSONObject): Schedule {
        val daysJson = json.optJSONArray("days") ?: JSONArray()
        val days = (0 until daysJson.length()).map { daysJson.optString(it) }
        val periodsJson = json.optJSONArray("periods") ?: JSONArray()
        val periods = (0 until periodsJson.length()).map { index ->
            val period = periodsJson.getJSONObject(index)
            val daysArray = period.optJSONArray("days") ?: JSONArray()
            val dayCourses = (0 until daysArray.length()).map { dayIndex ->
                val courses = daysArray.optJSONArray(dayIndex) ?: JSONArray()
                (0 until courses.length()).map { courseIndex ->
                    val course = courses.getJSONObject(courseIndex)
                    ScheduleCourse(
                        name = course.optString("name"),
                        weeks = course.optString("weeks"),
                        teacher = course.optString("teacher"),
                        room = course.optString("room"),
                    )
                }
            }
            SchedulePeriod(
                period = period.optString("period"),
                time = period.optString("time"),
                section = period.optString("section"),
                days = dayCourses,
            )
        }
        return Schedule(
            owner = json.optString("owner"),
            term = json.optString("term"),
            termStart = json.optString("termStart"),
            days = if (days.isEmpty()) EmbeddedSchedule.days else days,
            periods = periods,
            imported = true,
        )
    }

    /* ----------------------------------------------------------- parsers ---- */

    private const val CELL = "\u001f"
    private const val ROW = "\u001e"

    /** 教务系统导出的 RTF/DOC。 */
    fun parseRtf(rtf: String): Schedule {
        val marked = rtfToMarkedText(rtf)
        val rows = marked.split(ROW)
            .map { row -> row.split(CELL).map { cleanCell(it) } }
            .filter { cells -> cells.any { it.isNotEmpty() } }
        return fromCells(rows)
    }

    /** 表格另存为的 HTML。 */
    fun parseHtml(html: String): Schedule {
        val rows = mutableListOf<List<String>>()
        val rowRegex = Regex("<tr[^>]*>(.*?)</tr>", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
        val cellRegex = Regex("<t[dh][^>]*>(.*?)</t[dh]>", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
        rowRegex.findAll(html).forEach { rowMatch ->
            val cells = cellRegex.findAll(rowMatch.groupValues[1])
                .map { match -> cleanCell(htmlToText(match.groupValues[1])) }
                .toList()
            if (cells.isNotEmpty()) rows.add(cells)
        }
        return fromCells(rows)
    }

    /** 复制的课表文本 / CSV。 */
    fun parseText(text: String): Schedule {
        val rows = mutableListOf<MutableList<String>>()
        var current: MutableList<String>? = null
        text.replace("\r\n", "\n").split("\n").forEach { rawLine ->
            val line = rawLine.trim()
            if (line.isEmpty()) return@forEach
            when {
                line.startsWith("节次") || line.startsWith("星期") -> {
                    rows.add(line.split("\t", "  ").map { it.trim() }.toMutableList())
                    current = null
                }
                line.matches(Regex("^第.*节.*")) -> {
                    current = line.split("\t").map { it.trim() }.toMutableList()
                    rows.add(current!!)
                }
                current != null -> {
                    val parts = line.split("\t")
                    if (parts.size > 1) current!!.addAll(parts.map { it.trim() })
                    else current!![current!!.lastIndex] = current!!.last().ifEmpty { line } .let {
                        if (it.isEmpty()) line else "$it\n$line"
                    }
                }
            }
        }
        return fromCells(rows.map { it.toList() })
    }

    private fun fromCells(rows: List<List<String>>): Schedule {
        val header = rows.firstOrNull { cells -> cells.firstOrNull()?.contains("星期") == true || cells.firstOrNull()?.contains("节次") == true }
        var days = header?.drop(1)?.map { it.replace("\\s".toRegex(), "") }?.filter { it.isNotEmpty() } ?: emptyList()
        if (days.size < 5) days = EmbeddedSchedule.days

        val periods = mutableListOf<SchedulePeriod>()
        rows.forEach { cells ->
            val first = cells.firstOrNull()?.replace("\n", " ")?.trim() ?: return@forEach
            if (!first.matches(Regex("^第.*节.*"))) return@forEach
            val match = Regex("^(第\\S*节)\\s*(.*)$").find(first)
            val periodName = match?.groupValues?.get(1) ?: first
            val time = match?.groupValues?.get(2)?.trim().orEmpty()
            periods.add(
                SchedulePeriod(
                    period = periodName,
                    time = time,
                    section = sectionOf(periodName),
                    days = days.indices.map { index -> parseCourses(cells.getOrNull(index + 1).orEmpty()) },
                ),
            )
        }
        require(periods.isNotEmpty()) { "没有解析到课表节次，请确认文件内容" }
        return Schedule(
            owner = "广东财贸信创3班版权所有",
            term = EmbeddedSchedule.TERM,
            termStart = EmbeddedSchedule.TERM_START,
            days = days,
            periods = periods,
            imported = true,
        )
    }

    private fun parseCourses(cell: String): List<ScheduleCourse> {
        if (cell.isBlank()) return emptyList()
        val lines = cell.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        val groups = mutableListOf<MutableList<String>>()
        lines.forEach { line ->
            val isDetail = line.matches(Regex("^\\[.*]$")) ||
                line.contains("周[") ||
                Regex("班$|班\\[").containsMatchIn(line) ||
                Regex("^\\d+-\\d+").containsMatchIn(line) ||
                Regex("[馆室楼]|校区|\\[\\d+人]").containsMatchIn(line)
            if (!isDetail || groups.isEmpty()) groups.add(mutableListOf(line)) else groups.last().add(line)
        }
        return groups.map { group ->
            val weeks = group.firstOrNull { it.contains("周[") }.orEmpty()
            val teacher = group.firstOrNull { it.matches(Regex("^\\[.*]$")) }.orEmpty()
            val rest = group.filter { it != weeks && it != teacher }
            val room = rest.firstOrNull { Regex("\\d+-\\d+|[馆室楼]|校区").containsMatchIn(it) }.orEmpty()
            ScheduleCourse(
                name = group.first(),
                weeks = weeks.replace(Regex("\\[.*]"), "").replace("周", "").trim(),
                teacher = teacher.trim('[', ']'),
                room = room.replace(Regex("\\[\\d+人]"), "").trim(),
            )
        }
    }

    private fun sectionOf(period: String): String {
        if (period.contains("中午")) return "noon"
        val index = Regex("第(\\d+)").find(period)?.groupValues?.get(1)?.toIntOrNull() ?: 0
        return when {
            index <= 4 -> "morning"
            index <= 8 -> "afternoon"
            else -> "evening"
        }
    }

    /** RTF -> 用分隔符标记的纯文本（保留文档里的 UTF-8 字节）。 */
    private fun rtfToMarkedText(rtf: String): String {
        val out = StringBuilder()
        var i = 0
        while (i < rtf.length) {
            val char = rtf[i]
            when {
                char == '{' || char == '}' -> i += 1
                char != '\\' -> {
                    out.append(char)
                    i += 1
                }
                else -> {
                    val rest = rtf.substring(i)
                    val unicode = Regex("^\\\\u(-?\\d+)\\s?\\??").find(rest)
                    val hex = Regex("^\\\\'([0-9a-fA-F]{2})").find(rest)
                    val word = Regex("^\\\\([a-zA-Z]+)(-?\\d+)?\\s?").find(rest)
                    when {
                        unicode != null -> {
                            val code = unicode.groupValues[1].toInt()
                            out.append(((if (code < 0) code + 65536 else code)).toChar())
                            i += unicode.value.length
                        }
                        hex != null -> {
                            out.append(hex.groupValues[1].toInt(16).toChar())
                            i += hex.value.length
                        }
                        word != null -> {
                            when (word.groupValues[1]) {
                                "cell" -> out.append(CELL)
                                "row", "nestrow" -> out.append(ROW)
                                "par", "line" -> out.append('\n')
                                "tab" -> out.append('\t')
                            }
                            i += word.value.length
                        }
                        else -> i += 1
                    }
                }
            }
        }
        // RTF 里中文以 UTF-8 字节保存，按字节还原成字符串
        val bytes = ByteArray(out.length)
        out.forEachIndexed { index, c -> bytes[index] = c.code.toByte() }
        return String(bytes, Charsets.UTF_8)
    }

    private fun htmlToText(html: String): String = html
        .replace(Regex("<br\\s*/?>", RegexOption.IGNORE_CASE), "\n")
        .replace(Regex("</p>", RegexOption.IGNORE_CASE), "\n")
        .replace(Regex("<[^>]+>"), "")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")

    private fun cleanCell(text: String): String = text
        .split("\n")
        .map { it.trim() }
        .filter { it.isNotEmpty() && !it.matches(Regex("^-{3,}$")) }
        .joinToString("\n")
        .trim()
}
