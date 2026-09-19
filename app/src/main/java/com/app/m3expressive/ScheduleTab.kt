package com.app.m3expressive

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.Navigation
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.RestartAlt
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/* ------------------------------------------------------------------ 课表 --- */

private val WEEKDAY_SHORT = listOf("周一", "周二", "周三", "周四", "周五", "周六", "周日")
private val SECTION_LABEL = mapOf(
    "morning" to "上午",
    "noon" to "中午",
    "afternoon" to "下午",
    "evening" to "晚上",
)

/** 周一 = 0 ... 周日 = 6 */
private fun dayIndex(date: LocalDate): Int = date.dayOfWeek.value - 1

private fun mondayOf(date: LocalDate): LocalDate = date.minusDays(dayIndex(date).toLong())

/** 教学周（第 1 周从 termStart 起算）。 */
private fun weekNumber(date: LocalDate, termStart: String): Int {
    val start = runCatching { LocalDate.parse(termStart) }.getOrNull() ?: return 1
    val weeks = ChronoUnit.WEEKS.between(mondayOf(start), mondayOf(date))
    return (weeks + 1).toInt().coerceAtLeast(1)
}

/** 周次范围 "4;6-9;12-20" 是否包含某一周。 */
private fun runsInWeek(course: ScheduleCourse, week: Int): Boolean {
    if (course.weeks.isBlank()) return true
    val spec = course.weeks.replace("周", "")
    return spec.split(';', ',', '，', ' ').filter { it.isNotBlank() }.any { part ->
        val range = part.split('-')
        when {
            range.size == 2 -> {
                val from = range[0].trim().toIntOrNull()
                val to = range[1].trim().toIntOrNull()
                from != null && to != null && week in from..to
            }
            else -> part.trim().toIntOrNull() == week
        }
    }
}

private data class DayCourse(val period: SchedulePeriod, val course: ScheduleCourse)

private fun coursesOfDay(schedule: Schedule, day: Int, week: Int): List<DayCourse> =
    schedule.periods.flatMap { period ->
        period.days.getOrNull(day).orEmpty()
            .filter { runsInWeek(it, week) }
            .map { DayCourse(period, it) }
    }

/** 读取 SAF 返回文件的显示名。 */
private fun displayName(context: Context, uri: Uri): String {
    var name = uri.lastPathSegment ?: "课表文件"
    runCatching {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index >= 0 && cursor.moveToFirst()) name = cursor.getString(index) ?: name
        }
    }
    return name
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen() {
    val context = LocalContext.current
    val today = remember { LocalDate.now() }
    var schedule by remember { mutableStateOf(ScheduleCodec.current(context)) }
    var status by remember { mutableStateOf<String?>(null) }

    // 系统内置文件选择器（SAF）：选完直接解析并保存
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        val name = displayName(context, uri)
        runCatching {
            val stream = context.contentResolver.openInputStream(uri) ?: error("无法读取所选文件")
            stream.use { input ->
                val parsed = ScheduleCodec.parse(context, input, name)
                ScheduleCodec.save(context, parsed)
                schedule = parsed
                "已导入 $name：${parsed.periods.size} 个节次 · ${parsed.courseCount} 门课"
            }
        }.onSuccess { status = it }
            .onFailure { status = "「$name」解析失败：${it.message}。支持教务系统导出的 .doc/.rtf、另存为的 .html、.csv/.txt" }
    }

    val initialWindow = remember {
        val index = dayIndex(today)
        if (index <= 3) mondayOf(today) else mondayOf(today).plusDays((index - 3).toLong())
    }
    var windowStart by remember { mutableStateOf(initialWindow) }
    var selected by remember { mutableStateOf(today) }
    var detail by remember { mutableStateOf<DayCourse?>(null) }
    var pendingAddress by remember { mutableStateOf<String?>(null) }
    val sheetState = rememberModalBottomSheetState()

    val week = weekNumber(selected, schedule.termStart)
    val days = (0..3).map { windowStart.plusDays(it.toLong()) }

    Column(Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        // 标题 + 导入 / 恢复
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.CalendarMonth, null, tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text("多分课表", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(
                    "${schedule.term} · 第 $week 教学周 · ${schedule.owner}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = { importLauncher.launch(arrayOf("*/*")) }) {
                Icon(Icons.Outlined.FolderOpen, "用系统文件管理器导入课表")
            }
            IconButton(onClick = {
                ScheduleCodec.clear(context)
                schedule = ScheduleCodec.builtIn
                status = "已恢复内置课表"
            }) {
                Icon(Icons.Outlined.RestartAlt, "恢复内置课表")
            }
        }

        status?.let { text ->
            Text(
                text,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 4.dp),
            )
        }

        Row(
            Modifier.fillMaxWidth().padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            IconButton(onClick = { windowStart = windowStart.minusWeeks(1); selected = selected.minusWeeks(1) }) {
                Icon(Icons.Outlined.ChevronLeft, "上一周")
            }
            Text(
                "第 $week 周 · ${days.last().monthValue}月${days.last().dayOfMonth}日止",
                style = MaterialTheme.typography.titleSmall,
            )
            IconButton(onClick = { windowStart = windowStart.plusWeeks(1); selected = selected.plusWeeks(1) }) {
                Icon(Icons.Outlined.ChevronRight, "下一周")
            }
        }

        // 四日表格
        Card(
            Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        ) {
            Row(Modifier.fillMaxWidth().padding(4.dp)) {
                Spacer(Modifier.width(52.dp))
                days.forEach { date ->
                    val index = dayIndex(date)
                    val isToday = date == today
                    val isSelected = date == selected
                    val container = when {
                        isSelected -> MaterialTheme.colorScheme.primaryContainer
                        isToday -> MaterialTheme.colorScheme.secondaryContainer
                        else -> MaterialTheme.colorScheme.surfaceContainer
                    }
                    Column(
                        Modifier
                            .weight(1f)
                            .padding(horizontal = 2.dp)
                            .background(container, RoundedCornerShape(14.dp))
                            .clickable { selected = date }
                            .padding(vertical = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(WEEKDAY_SHORT[index], style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                        Text("${date.monthValue}月${date.dayOfMonth}日", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }

            Column(Modifier.verticalScroll(rememberScrollState()).height(430.dp)) {
                var lastSection: String? = null
                schedule.periods.forEach { period ->
                    if (period.section != lastSection) {
                        lastSection = period.section
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                SECTION_LABEL[period.section] ?: period.section,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.width(8.dp))
                            Box(
                                Modifier
                                    .weight(1f)
                                    .height(1.dp)
                                    .background(MaterialTheme.colorScheme.outlineVariant),
                            )
                        }
                    }
                    Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 2.dp)) {
                        Column(Modifier.width(52.dp).padding(start = 6.dp)) {
                            Text(
                                period.period.replace("第", "").replace("节", ""),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                period.time.substringBefore('-'),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        days.forEach { date ->
                            val index = dayIndex(date)
                            val courses = period.days.getOrNull(index).orEmpty().filter { runsInWeek(it, week) }
                            Column(Modifier.weight(1f).padding(horizontal = 2.dp)) {
                                if (courses.isEmpty()) {
                                    Text(
                                        "—",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(6.dp),
                                    )
                                } else {
                                    courses.forEach { course ->
                                        Card(
                                            Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 2.dp)
                                                .clickable { detail = DayCourse(period, course) },
                                            colors = CardDefaults.cardColors(
                                                containerColor = MaterialTheme.colorScheme.surfaceContainerHighest,
                                            ),
                                            shape = RoundedCornerShape(12.dp),
                                        ) {
                                            Text(
                                                course.name,
                                                style = MaterialTheme.typography.labelSmall,
                                                maxLines = 3,
                                                overflow = TextOverflow.Ellipsis,
                                                modifier = Modifier.padding(6.dp),
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        Text(
            "${WEEKDAY_SHORT[dayIndex(selected)]} ${selected.monthValue}月${selected.dayOfMonth}日 · ${coursesOfDay(schedule, dayIndex(selected), week).size} 门课",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(8.dp))
        Column(Modifier.verticalScroll(rememberScrollState())) {
            val entries = coursesOfDay(schedule, dayIndex(selected), week)
            if (entries.isEmpty()) {
                Text(
                    "这一天没有课程。左右滑动与上方表格可查看其他日期。",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                entries.forEach { entry ->
                    Card(
                        Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable { detail = entry },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                    ) {
                        Row(Modifier.fillMaxWidth().padding(12.dp)) {
                            Column(Modifier.width(64.dp)) {
                                Text(
                                    entry.period.period.replace("第", "").replace("节", ""),
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(entry.period.time, style = MaterialTheme.typography.labelSmall)
                            }
                            Column(Modifier.weight(1f)) {
                                Text(entry.course.name, style = MaterialTheme.typography.titleSmall)
                                Text(
                                    "${entry.course.teacher.ifBlank { "未填写教师" }} · ${entry.course.weeks.ifBlank { "每周" }} 周",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                if (entry.course.room.isNotBlank()) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Outlined.Place, null, Modifier.size(14.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text(entry.course.room, style = MaterialTheme.typography.bodySmall)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    detail?.let { entry ->
        ModalBottomSheet(onDismissRequest = { detail = null }, sheetState = sheetState) {
            Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(entry.course.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Schedule, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "${WEEKDAY_SHORT[dayIndex(selected)]} · ${entry.period.period} · ${entry.period.time}",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                Text("授课老师：${entry.course.teacher.ifBlank { "未填写" }}", style = MaterialTheme.typography.bodyMedium)
                Text("周次：${entry.course.weeks.ifBlank { "每周" }} 周", style = MaterialTheme.typography.bodyMedium)
                Text("地点：${entry.course.room.ifBlank { "未填写" }}", style = MaterialTheme.typography.bodyMedium)
                if (entry.course.room.isNotBlank()) {
                    TextButton(onClick = { pendingAddress = entry.course.room }) {
                        Icon(Icons.Outlined.Navigation, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("导航前往")
                    }
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }

    pendingAddress?.let { address ->
        MapProviderDialog(
            address = address,
            onDismiss = { pendingAddress = null },
            onConfirm = { providerId, remember ->
                pendingAddress = null
                if (remember) MapPreferences.setProvider(context, providerId)
                openMap(context, address, providerId)
            },
        )
    }
}

/* ------------------------------------------------------------------ 地图 --- */

private val MAP_PROVIDERS = listOf(
    "amap" to "高德地图",
    "baidu" to "百度地图",
    "tencent" to "腾讯地图",
    "google" to "Google 地图",
    "apple" to "Apple 地图",
)

private object MapPreferences {
    private const val PREFS = "m3expressive"
    private const val KEY = "map_provider"

    fun provider(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)

    fun setProvider(context: Context, id: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, id).apply()
    }
}

private fun mapUri(provider: String, address: String): Uri {
    val encoded = Uri.encode(address)
    return when (provider) {
        "amap" -> Uri.parse("https://uri.amap.com/search?keyword=$encoded&src=m3expressive&coordinate=gaode&callnative=1")
        "baidu" -> Uri.parse("https://map.baidu.com/search?querytype=s&wd=$encoded")
        "tencent" -> Uri.parse("https://apis.map.qq.com/uri/v1/search?keyword=$encoded&referer=m3expressive")
        "google" -> Uri.parse("https://www.google.com/maps/search/?api=1&query=$encoded")
        "apple" -> Uri.parse("https://maps.apple.com/?q=$encoded")
        else -> Uri.parse("geo:0,0?q=$encoded")
    }
}

/** 启动导航：已设置默认地图就直接跳转。 */
fun openMap(context: Context, address: String, providerId: String? = null) {
    val provider = providerId ?: MapPreferences.provider(context) ?: return
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, mapUri(provider, address))) }
}

@Composable
private fun MapProviderDialog(
    address: String,
    onDismiss: () -> Unit,
    onConfirm: (providerId: String, remember: Boolean) -> Unit,
) {
    var selected by remember { mutableStateOf(MAP_PROVIDERS.first().first) }
    var remember by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("选择地图应用") },
        text = {
            Column {
                Text("将为「$address」启动导航", style = MaterialTheme.typography.bodyMedium)
                Spacer(Modifier.height(8.dp))
                MAP_PROVIDERS.forEach { (id, label) ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { selected = id }
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier
                                .size(18.dp)
                                .border(
                                    2.dp,
                                    if (selected == id) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                                    RoundedCornerShape(9.dp),
                                )
                                .background(
                                    if (selected == id) MaterialTheme.colorScheme.primary else Color.Transparent,
                                    RoundedCornerShape(9.dp),
                                ),
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(label)
                    }
                }
                Row(Modifier.clickable { remember = !remember }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(18.dp)
                            .border(2.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(4.dp))
                            .background(if (remember) MaterialTheme.colorScheme.primary else Color.Transparent, RoundedCornerShape(4.dp)),
                    )
                    Spacer(Modifier.width(12.dp))
                    Text("记住选择", style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = { TextButton(onClick = { onConfirm(selected, remember) }) { Text("打开地图") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } },
    )
}
