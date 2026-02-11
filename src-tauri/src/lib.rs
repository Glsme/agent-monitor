use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use tauri::Emitter;

static WATCHER_STOP: Mutex<Option<Arc<AtomicBool>>> = Mutex::new(None);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TeamMember {
    pub name: String,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "agentType")]
    pub agent_type: Option<String>,
    pub model: Option<String>,
    pub prompt: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "planModeRequired")]
    pub plan_mode_required: Option<bool>,
    #[serde(rename = "joinedAt")]
    pub joined_at: Option<serde_json::Value>,
    #[serde(rename = "tmuxPaneId")]
    pub tmux_pane_id: Option<String>,
    pub cwd: Option<String>,
    pub subscriptions: Option<Vec<serde_json::Value>>,
    #[serde(rename = "backendType")]
    pub backend_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TeamConfig {
    pub name: String,
    pub members: Vec<TeamMember>,
    pub description: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<serde_json::Value>,
    #[serde(rename = "leadAgentId")]
    pub lead_agent_id: Option<String>,
    #[serde(rename = "leadSessionId")]
    pub lead_session_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskData {
    pub id: String,
    pub subject: String,
    pub description: Option<String>,
    pub status: String,
    pub owner: Option<String>,
    #[serde(rename = "activeForm")]
    pub active_form: Option<String>,
    #[serde(rename = "blockedBy")]
    pub blocked_by: Option<Vec<String>>,
    pub blocks: Option<Vec<String>>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<serde_json::Value>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InboxMessage {
    pub from: Option<String>,
    pub to: Option<String>,
    pub content: Option<String>,
    #[serde(rename = "type")]
    pub msg_type: Option<String>,
    pub timestamp: Option<String>,
    pub summary: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentState {
    pub name: String,
    pub agent_id: String,
    pub agent_type: Option<String>,
    pub status: String, // "idle", "working", "blocked", "offline"
    pub current_task: Option<TaskData>,
    pub recent_messages: Vec<InboxMessage>,
    pub task_count: TaskCount,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskCount {
    pub pending: usize,
    pub in_progress: usize,
    pub completed: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TeamSnapshot {
    pub team_name: String,
    pub description: Option<String>,
    pub agents: Vec<AgentState>,
    pub all_tasks: Vec<TaskData>,
    pub timeline: Vec<TimelineEvent>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineEvent {
    pub timestamp: String,
    pub agent: String,
    pub event_type: String, // "task_started", "task_completed", "message_sent", "status_change"
    pub description: String,
}

fn get_claude_dir() -> PathBuf {
    home_dir().join(".claude")
}

fn home_dir() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp"))
}

#[tauri::command]
fn list_teams() -> Result<Vec<String>, String> {
    let teams_dir = get_claude_dir().join("teams");
    if !teams_dir.exists() {
        return Ok(vec![]);
    }

    let mut teams = Vec::new();
    let entries = std::fs::read_dir(&teams_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            if let Some(name) = entry.file_name().to_str() {
                let config_path = teams_dir.join(name).join("config.json");
                if config_path.exists() {
                    teams.push(name.to_string());
                }
            }
        }
    }
    Ok(teams)
}

#[tauri::command]
fn get_team_snapshot(team_name: String) -> Result<TeamSnapshot, String> {
    let claude_dir = get_claude_dir();
    let team_dir = claude_dir.join("teams").join(&team_name);
    let tasks_dir = claude_dir.join("tasks").join(&team_name);

    // Read team config
    let config_path = team_dir.join("config.json");
    let config: TeamConfig = if config_path.exists() {
        let data = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse team config: {}", e))?
    } else {
        return Err(format!("Team config not found: {}", config_path.display()));
    };

    // Read all tasks
    let all_tasks = read_tasks(&tasks_dir)?;

    // Build agent states
    let mut agents = Vec::new();
    let inboxes_dir = team_dir.join("inboxes");

    for member in &config.members {
        let owned_tasks: Vec<&TaskData> = all_tasks
            .iter()
            .filter(|t| t.owner.as_deref() == Some(&member.name))
            .collect();

        let current_task = owned_tasks
            .iter()
            .find(|t| t.status == "in_progress")
            .cloned()
            .cloned();

        let status = if current_task.is_some() {
            "working".to_string()
        } else if owned_tasks.iter().any(|t| {
            t.blocked_by
                .as_ref()
                .map(|b| !b.is_empty())
                .unwrap_or(false)
        }) {
            "blocked".to_string()
        } else {
            "idle".to_string()
        };

        let task_count = TaskCount {
            pending: owned_tasks.iter().filter(|t| t.status == "pending").count(),
            in_progress: owned_tasks
                .iter()
                .filter(|t| t.status == "in_progress")
                .count(),
            completed: owned_tasks
                .iter()
                .filter(|t| t.status == "completed")
                .count(),
        };

        let recent_messages = read_inbox(&inboxes_dir, &member.name)?;

        agents.push(AgentState {
            name: member.name.clone(),
            agent_id: member.agent_id.clone(),
            agent_type: member.agent_type.clone(),
            status,
            current_task,
            recent_messages,
            task_count,
        });
    }

    // Build timeline
    let timeline = build_timeline(&all_tasks, &agents);

    Ok(TeamSnapshot {
        team_name: config.name,
        description: config.description,
        agents,
        all_tasks,
        timeline,
    })
}

fn read_tasks(tasks_dir: &PathBuf) -> Result<Vec<TaskData>, String> {
    if !tasks_dir.exists() {
        return Ok(vec![]);
    }

    let mut tasks = Vec::new();
    let entries = std::fs::read_dir(tasks_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "json").unwrap_or(false) {
            if let Ok(data) = std::fs::read_to_string(&path) {
                if let Ok(task) = serde_json::from_str::<TaskData>(&data) {
                    tasks.push(task);
                }
            }
        }
    }
    tasks.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(tasks)
}

fn read_inbox(inboxes_dir: &PathBuf, agent_name: &str) -> Result<Vec<InboxMessage>, String> {
    let inbox_path = inboxes_dir.join(format!("{}.json", agent_name));
    if !inbox_path.exists() {
        return Ok(vec![]);
    }

    let data = std::fs::read_to_string(&inbox_path).map_err(|e| e.to_string())?;

    // Try parsing as array first, then as single message
    if let Ok(messages) = serde_json::from_str::<Vec<InboxMessage>>(&data) {
        Ok(messages.into_iter().rev().take(20).collect())
    } else if let Ok(msg) = serde_json::from_str::<InboxMessage>(&data) {
        Ok(vec![msg])
    } else {
        // Try NDJSON (newline-delimited JSON)
        let messages: Vec<InboxMessage> = data
            .lines()
            .filter_map(|line| serde_json::from_str(line).ok())
            .collect();
        Ok(messages.into_iter().rev().take(20).collect())
    }
}

fn build_timeline(tasks: &[TaskData], agents: &[AgentState]) -> Vec<TimelineEvent> {
    let mut events = Vec::new();

    for task in tasks {
        let ts = task.updated_at.as_ref().map(|v| match v {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Number(n) => n.to_string(),
            _ => String::new(),
        }).unwrap_or_default();

        if !ts.is_empty() {
            let agent = task.owner.clone().unwrap_or_else(|| "unknown".to_string());
            let event_type = match task.status.as_str() {
                "in_progress" => "task_started",
                "completed" => "task_completed",
                _ => "status_change",
            };
            events.push(TimelineEvent {
                timestamp: ts,
                agent,
                event_type: event_type.to_string(),
                description: format!("[{}] {}", task.status, task.subject),
            });
        }
    }

    for agent in agents {
        for msg in &agent.recent_messages {
            if let Some(ref ts) = msg.timestamp {
                events.push(TimelineEvent {
                    timestamp: ts.clone(),
                    agent: msg.from.clone().unwrap_or_else(|| agent.name.clone()),
                    event_type: "message_sent".to_string(),
                    description: msg
                        .summary
                        .clone()
                        .or_else(|| msg.content.as_ref().map(|c| c.chars().take(80).collect()))
                        .unwrap_or_else(|| "message".to_string()),
                });
            }
        }
    }

    events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    events.truncate(100);
    events
}

#[tauri::command]
fn watch_team(app: tauri::AppHandle, team_name: String) -> Result<(), String> {
    let claude_dir = get_claude_dir();
    let team_dir = claude_dir.join("teams").join(&team_name);
    let tasks_dir = claude_dir.join("tasks").join(&team_name);

    // Signal previous watcher to stop
    let stop_flag = Arc::new(AtomicBool::new(false));
    {
        let mut guard = WATCHER_STOP.lock().map_err(|e| e.to_string())?;
        if let Some(prev) = guard.take() {
            prev.store(true, Ordering::Relaxed);
        }
        *guard = Some(Arc::clone(&stop_flag));
    }

    std::thread::spawn(move || {
        use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
        use std::sync::mpsc;
        use std::time::Duration;

        let (tx, rx) = mpsc::channel();

        let mut watcher = match RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(_event) = res {
                    let _ = tx.send(());
                }
            },
            Config::default(),
        ) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create watcher: {}", e);
                return;
            }
        };

        if team_dir.exists() {
            let _ = watcher.watch(&team_dir, RecursiveMode::Recursive);
        }
        if tasks_dir.exists() {
            let _ = watcher.watch(&tasks_dir, RecursiveMode::Recursive);
        }

        loop {
            if stop_flag.load(Ordering::Relaxed) {
                break;
            }

            if rx.recv_timeout(Duration::from_secs(2)).is_ok() {
                // Debounce: drain additional events
                while rx.recv_timeout(Duration::from_millis(200)).is_ok() {}

                if stop_flag.load(Ordering::Relaxed) {
                    break;
                }

                if let Ok(snapshot) = get_team_snapshot(team_name.clone()) {
                    let _ = app.emit("team-update", snapshot);
                }
            }
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            list_teams,
            get_team_snapshot,
            watch_team,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
