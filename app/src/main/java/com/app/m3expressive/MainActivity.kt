package com.app.m3expressive

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognizerIntent
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.addCallback
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.TextFields
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.app.m3expressive.ui.theme.M3ExpressiveTheme

private data class HistoryRecord(val title: String, val detail: String)
private enum class AppTab { HOME, HISTORY, SCHEDULE, SETTINGS }

class MainActivity : ComponentActivity() {

    /** 当前标签页提升到 Activity 层，便于系统返回手势（可预测式返回）读取 */
    private val currentTab = mutableStateOf(AppTab.HOME)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Android 16 Live Updates / ColorOS 流体云 渠道
        LiveUpdates.ensureChannel(this)

        // 可预测式返回：非首页时先回到首页，首页再按一次才退出应用
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (currentTab.value != AppTab.HOME) {
                        currentTab.value = AppTab.HOME
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        isEnabled = true
                    }
                }
            },
        )

        setContent { M3ExpressiveTheme { M3ExpressiveApp(currentTab) } }
    }
}

@Composable
private fun M3ExpressiveApp(navTab: MutableState<AppTab>) {
    val context = LocalContext.current
    val tab by navTab
    val setTab: (AppTab) -> Unit = { navTab.value = it }
    var status by remember { mutableStateOf("准备就绪") }
    var sttApi by remember { mutableStateOf("") }
    var i2tApi by remember { mutableStateOf("") }
    // 快速开始：点击语音后显示进度条并发布实时通知（ColorOS 流体云）
    var listening by remember { mutableStateOf(false) }
    var recordSeconds by remember { mutableStateOf(0) }
    val history = remember { mutableStateListOf<HistoryRecord>() }

    androidx.compose.runtime.LaunchedEffect(listening) {
        recordSeconds = 0
        while (listening) {
            kotlinx.coroutines.delay(1000)
            recordSeconds += 1
            LiveUpdates.update(
                context,
                "正在录音 · 多分课表",
                "%02d:%02d · 实时语音转文字进行中".format(recordSeconds / 60, recordSeconds % 60),
            )
        }
    }

    // Android 13+ 通知权限：Live Updates / 流体云 需要它
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> if (!granted) status = "未授予通知权限，流体云状态不可见" }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    val speechLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        listening = false
        val text = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (!text.isNullOrBlank()) {
            history.add(0, HistoryRecord("语音转文字", text))
            status = "已完成语音识别"
            LiveUpdates.finish(context, "语音识别完成", text.take(80))
        } else {
            status = "没有识别到内容"
            LiveUpdates.clear(context)
        }
    }
    val microphonePermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            listening = true
            LiveUpdates.update(context, "正在录音 · 多分课表", "00:00 · 实时语音转文字进行中")
            startSpeechRecognition(context, speechLauncher::launch) {
                listening = false
                status = it
                LiveUpdates.clear(context)
            }
        } else {
            status = "需要麦克风权限才能使用语音识别"
        }
    }
    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap != null) {
            history.add(0, HistoryRecord("图片转文字", "已拍摄图片，等待图像文字识别"))
            status = "图片已捕获"
            LiveUpdates.finish(context, "图片已捕获", "等待图像文字识别")
        } else {
            status = "未获取到图片"
            LiveUpdates.clear(context)
        }
    }
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) cameraLauncher.launch(null) else status = "需要相机权限才能拍照"
    }

    Scaffold(bottomBar = {
        NavigationBar {
            NavigationBarItem(tab == AppTab.HOME, { setTab(AppTab.HOME) }, icon = { Icon(Icons.Outlined.Home, null) }, label = { Text("首页") })
            NavigationBarItem(tab == AppTab.HISTORY, { setTab(AppTab.HISTORY) }, icon = { Icon(Icons.Outlined.History, null) }, label = { Text("历史") })
            NavigationBarItem(
                tab == AppTab.SCHEDULE,
                { setTab(AppTab.SCHEDULE) },
                icon = { Icon(Icons.Outlined.CalendarMonth, null) },
                label = { Text("课表") },
            )
            NavigationBarItem(tab == AppTab.SETTINGS, { setTab(AppTab.SETTINGS) }, icon = { Icon(Icons.Outlined.Settings, null) }, label = { Text("设置") })
        }
    }) { padding ->
        Surface(Modifier.fillMaxSize().padding(padding), color = MaterialTheme.colorScheme.background) {
            when (tab) {
                AppTab.HOME -> HomeScreen(status, listening, recordSeconds, {
                    if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        listening = true
                        LiveUpdates.update(context, "正在录音 · 多分课表", "00:00 · 实时语音转文字进行中")
                        startSpeechRecognition(context, speechLauncher::launch) {
                            listening = false
                            status = it
                            LiveUpdates.clear(context)
                        }
                    } else {
                        microphonePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    }
                }, {
                    if (context.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        LiveUpdates.update(context, "拍照记录", "正在打开相机…")
                        cameraLauncher.launch(null)
                    } else {
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                }) { setTab(AppTab.SETTINGS) }
                AppTab.HISTORY -> HistoryScreen(history)
                AppTab.SCHEDULE -> ScheduleScreen()
                AppTab.SETTINGS -> SettingsScreen(sttApi, i2tApi, { sttApi = it }, { i2tApi = it }, { status = "API 配置已保存" }) {
                    context.startActivity(Intent(Settings.ACTION_SETTINGS))
                }
            }
        }
    }
}

private fun startSpeechRecognition(
    context: android.content.Context,
    launch: (Intent) -> Unit,
    onUnavailable: (String) -> Unit
) {
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_PROMPT, "请开始说话")
    }
    if (intent.resolveActivity(context.packageManager) != null) {
        launch(intent)
    } else {
        onUnavailable("当前设备没有可用的语音识别服务")
    }
}

@Composable
private fun HomeScreen(
    status: String,
    listening: Boolean,
    recordSeconds: Int,
    onSpeech: () -> Unit,
    onCamera: () -> Unit,
    onSettings: () -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("M3 Expressive", style = MaterialTheme.typography.headlineMedium)
        Text("多模态记录工作台", style = MaterialTheme.typography.titleMedium)
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("快速开始", style = MaterialTheme.typography.titleLarge)
                Text("使用语音或相机创建一条新的记录。", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(onClick = onSpeech, enabled = !listening, modifier = Modifier.weight(1f)) { Icon(Icons.Outlined.Mic, null); Spacer(Modifier.size(8.dp)); Text("语音") }
                    Button(onClick = onCamera, modifier = Modifier.weight(1f)) { Icon(Icons.Outlined.CameraAlt, null); Spacer(Modifier.size(8.dp)); Text("拍照") }
                }

                // 点击语音后的进度条 + 计时，同时发布 Live Updates（ColorOS 流体云）
                if (listening) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text("正在录音 · 实时语音转文字", style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
                            Text(
                                "%02d:%02d".format(recordSeconds / 60, recordSeconds % 60),
                                style = MaterialTheme.typography.labelLarge,
                            )
                        }
                        LinearProgressIndicator(Modifier.fillMaxWidth())
                        Text(
                            "状态卡片已发送到通知 / 流体云",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
        Card(Modifier.fillMaxWidth()) {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.TextFields, null, Modifier.size(32.dp), tint = MaterialTheme.colorScheme.primary)
                Column(Modifier.padding(start = 12.dp).weight(1f)) {
                    Text("当前状态", style = MaterialTheme.typography.labelLarge)
                    Text(status)
                }
                IconButton(onClick = onSettings) { Icon(Icons.Outlined.Settings, "设置") }
            }
        }
    }
}

@Composable
private fun HistoryScreen(history: List<HistoryRecord>) {
    if (history.isEmpty()) {
        Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Icon(Icons.Outlined.History, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(12.dp))
            Text("还没有记录", style = MaterialTheme.typography.titleLarge)
            Text("完成一次语音识别或拍照后，结果会显示在这里。", textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    } else {
        LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { Text("历史记录", style = MaterialTheme.typography.headlineSmall) }
            items(history) { record ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text(record.title, style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(6.dp))
                        Text(record.detail, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(sttApi: String, i2tApi: String, onSttChange: (String) -> Unit, onI2tChange: (String) -> Unit, onSave: () -> Unit, onSystemSettings: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("API 设置", style = MaterialTheme.typography.headlineSmall)
        Text("配置后续联网识别服务的接口地址。", color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedTextField(sttApi, onSttChange, Modifier.fillMaxWidth(), label = { Text("语音转文字 API") }, singleLine = true)
        OutlinedTextField(i2tApi, onI2tChange, Modifier.fillMaxWidth(), label = { Text("图片转文字 API") }, singleLine = true)
        Button(onClick = onSave, Modifier.fillMaxWidth()) { Text("保存配置") }
        Button(onClick = onSystemSettings, Modifier.fillMaxWidth()) { Text("打开系统设置") }
    }
}
