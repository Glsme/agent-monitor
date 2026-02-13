use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::time::{SystemTime, UNIX_EPOCH};
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
    dirs::home_dir().unwrap_or_else(|| std::env::temp_dir())
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

// === Terminal Feature: New structs and commands ===

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandResult {
    pub success: bool,
    pub output: String,
    #[serde(rename = "type")]
    pub result_type: String, // "info", "success", "error", "message_list", "agent_list"
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalHistoryEntry {
    pub timestamp: String,
    pub command: String,
    pub result: CommandResult,
}

fn get_iso_timestamp() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let millis = duration.as_millis();
    format!("{}", millis)
}

#[tauri::command]
fn send_message_to_agent(team_name: String, agent_name: String, message: String, from: Option<String>) -> Result<CommandResult, String> {
    // Input validation
    if let Err(e) = validate_agent_name(&agent_name) {
        return Ok(CommandResult {
            success: false,
            output: e,
            result_type: "error".to_string(),
            data: None,
        });
    }
    if let Err(e) = validate_message(&message) {
        return Ok(CommandResult {
            success: false,
            output: e,
            result_type: "error".to_string(),
            data: None,
        });
    }

    let from = from.unwrap_or_else(|| "user".to_string());
    let claude_dir = get_claude_dir();
    let team_dir = claude_dir.join("teams").join(&team_name);

    // Verify team exists
    let config_path = team_dir.join("config.json");
    if !config_path.exists() {
        return Ok(CommandResult {
            success: false,
            output: format!("Team '{}' not found", team_name),
            result_type: "error".to_string(),
            data: None,
        });
    }

    // Verify agent exists in team
    let config_data = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let config: TeamConfig = serde_json::from_str(&config_data)
        .map_err(|e| format!("Failed to parse team config: {}", e))?;

    let agent_exists = config.members.iter().any(|m| m.name == agent_name);
    if !agent_exists {
        return Ok(CommandResult {
            success: false,
            output: format!("Agent '{}' not found in team '{}'", agent_name, team_name),
            result_type: "error".to_string(),
            data: None,
        });
    }

    // Build the inbox message
    let inbox_msg = InboxMessage {
        from: Some(from.clone()),
        to: Some(agent_name.clone()),
        content: Some(message.clone()),
        msg_type: Some("message".to_string()),
        timestamp: Some(get_iso_timestamp()),
        summary: Some(if message.len() > 60 {
            format!("{}...", &message[..57])
        } else {
            message.clone()
        }),
    };

    // Write to agent's inbox
    let inboxes_dir = team_dir.join("inboxes");
    if !inboxes_dir.exists() {
        std::fs::create_dir_all(&inboxes_dir).map_err(|e| e.to_string())?;
    }

    let inbox_path = inboxes_dir.join(format!("{}.json", agent_name));

    // Read existing messages
    let mut messages: Vec<InboxMessage> = if inbox_path.exists() {
        let data = std::fs::read_to_string(&inbox_path).map_err(|e| e.to_string())?;
        if let Ok(msgs) = serde_json::from_str::<Vec<InboxMessage>>(&data) {
            msgs
        } else if let Ok(msg) = serde_json::from_str::<InboxMessage>(&data) {
            vec![msg]
        } else {
            // Try NDJSON
            data.lines()
                .filter_map(|line| serde_json::from_str(line).ok())
                .collect()
        }
    } else {
        vec![]
    };

    messages.push(inbox_msg);

    // Write back as JSON array
    let json = serde_json::to_string_pretty(&messages).map_err(|e| e.to_string())?;
    std::fs::write(&inbox_path, json).map_err(|e| e.to_string())?;

    Ok(CommandResult {
        success: true,
        output: format!("Message sent to '{}'", agent_name),
        result_type: "success".to_string(),
        data: None,
    })
}

#[tauri::command]
fn execute_team_command(team_name: String, command: String) -> Result<CommandResult, String> {
    // Input validation
    if let Err(e) = validate_command(&command) {
        return Ok(CommandResult {
            success: false,
            output: e,
            result_type: "error".to_string(),
            data: None,
        });
    }

    let parts: Vec<&str> = command.trim().splitn(2, ' ').collect();
    let cmd = parts.first().unwrap_or(&"").to_lowercase();
    let args = parts.get(1).unwrap_or(&"").trim();

    match cmd.as_str() {
        "/status" | "status" => {
            cmd_status(&team_name, args)
        }
        "/tasks" | "tasks" => {
            cmd_tasks(&team_name, args)
        }
        "/agents" | "agents" => {
            cmd_agents(&team_name)
        }
        "/inbox" | "inbox" => {
            cmd_inbox(&team_name, args)
        }
        "/broadcast" | "broadcast" => {
            cmd_broadcast(&team_name, args)
        }
        "/history" | "history" => {
            cmd_history(&team_name)
        }
        "/help" | "help" => {
            cmd_help()
        }
        _ => {
            Ok(CommandResult {
                success: false,
                output: format!("Unknown command: '{}'. Type /help for available commands.", cmd),
                result_type: "error".to_string(),
                data: None,
            })
        }
    }
}

fn cmd_status(team_name: &str, agent_filter: &str) -> Result<CommandResult, String> {
    let snapshot = get_team_snapshot(team_name.to_string())?;

    if !agent_filter.is_empty() {
        // Show status for specific agent
        if let Some(agent) = snapshot.agents.iter().find(|a| a.name == agent_filter) {
            let task_info = agent.current_task.as_ref()
                .map(|t| format!("  Current: {} ({})", t.subject, t.status))
                .unwrap_or_else(|| "  No active task".to_string());

            let output = format!(
                "Agent: {}\nStatus: {}\nTasks: {} pending, {} active, {} done\n{}",
                agent.name,
                agent.status,
                agent.task_count.pending,
                agent.task_count.in_progress,
                agent.task_count.completed,
                task_info,
            );

            Ok(CommandResult {
                success: true,
                output,
                result_type: "info".to_string(),
                data: serde_json::to_value(agent).ok(),
            })
        } else {
            Ok(CommandResult {
                success: false,
                output: format!("Agent '{}' not found in team '{}'", agent_filter, team_name),
                result_type: "error".to_string(),
                data: None,
            })
        }
    } else {
        // Show team-wide status
        let mut lines = Vec::new();
        lines.push(format!("Team: {} ({} agents)", snapshot.team_name, snapshot.agents.len()));
        if let Some(ref desc) = snapshot.description {
            lines.push(format!("  {}", desc));
        }
        lines.push(String::new());

        for agent in &snapshot.agents {
            let task_info = agent.current_task.as_ref()
                .map(|t| format!(" -> {}", t.subject))
                .unwrap_or_default();
            lines.push(format!("  [{}] {}{}", agent.status.to_uppercase(), agent.name, task_info));
        }

        let total_tasks = snapshot.all_tasks.len();
        let completed = snapshot.all_tasks.iter().filter(|t| t.status == "completed").count();
        let in_progress = snapshot.all_tasks.iter().filter(|t| t.status == "in_progress").count();
        lines.push(String::new());
        lines.push(format!("Tasks: {}/{} completed, {} in progress", completed, total_tasks, in_progress));

        Ok(CommandResult {
            success: true,
            output: lines.join("\n"),
            result_type: "info".to_string(),
            data: None,
        })
    }
}

fn cmd_tasks(team_name: &str, filter: &str) -> Result<CommandResult, String> {
    let claude_dir = get_claude_dir();
    let tasks_dir = claude_dir.join("tasks").join(team_name);
    let tasks = read_tasks(&tasks_dir)?;

    let filtered: Vec<&TaskData> = if filter.is_empty() {
        tasks.iter().collect()
    } else {
        tasks.iter().filter(|t| {
            t.status == filter || t.owner.as_deref() == Some(filter)
        }).collect()
    };

    if filtered.is_empty() {
        return Ok(CommandResult {
            success: true,
            output: "No tasks found.".to_string(),
            result_type: "info".to_string(),
            data: None,
        });
    }

    let mut lines = Vec::new();
    for task in &filtered {
        let owner = task.owner.as_deref().unwrap_or("unassigned");
        let blocked = task.blocked_by.as_ref()
            .map(|b| if b.is_empty() { String::new() } else { format!(" (blocked by: {})", b.join(", ")) })
            .unwrap_or_default();
        lines.push(format!(
            "  #{} [{}] {} @{}{}",
            task.id, task.status.to_uppercase(), task.subject, owner, blocked
        ));
    }

    Ok(CommandResult {
        success: true,
        output: lines.join("\n"),
        result_type: "info".to_string(),
        data: serde_json::to_value(&filtered).ok(),
    })
}

fn cmd_agents(team_name: &str) -> Result<CommandResult, String> {
    let snapshot = get_team_snapshot(team_name.to_string())?;

    let mut lines = Vec::new();
    lines.push(format!("Agents in '{}':", team_name));
    lines.push(String::new());

    for agent in &snapshot.agents {
        let agent_type = agent.agent_type.as_deref().unwrap_or("unknown");
        let msgs = agent.recent_messages.len();
        lines.push(format!(
            "  {} ({}) - {} | Tasks: {}p/{}a/{}d | {} msgs",
            agent.name, agent_type, agent.status,
            agent.task_count.pending, agent.task_count.in_progress, agent.task_count.completed,
            msgs,
        ));
    }

    Ok(CommandResult {
        success: true,
        output: lines.join("\n"),
        result_type: "agent_list".to_string(),
        data: serde_json::to_value(&snapshot.agents).ok(),
    })
}

fn cmd_inbox(team_name: &str, agent_name: &str) -> Result<CommandResult, String> {
    if agent_name.is_empty() {
        return Ok(CommandResult {
            success: false,
            output: "Usage: /inbox <agent_name>".to_string(),
            result_type: "error".to_string(),
            data: None,
        });
    }

    let claude_dir = get_claude_dir();
    let inboxes_dir = claude_dir.join("teams").join(team_name).join("inboxes");
    let messages = read_inbox(&inboxes_dir, agent_name)?;

    if messages.is_empty() {
        return Ok(CommandResult {
            success: true,
            output: format!("No messages in {}'s inbox.", agent_name),
            result_type: "info".to_string(),
            data: None,
        });
    }

    let mut lines = Vec::new();
    lines.push(format!("Inbox for '{}' ({} messages):", agent_name, messages.len()));
    lines.push(String::new());

    for msg in messages.iter().take(10) {
        let from = msg.from.as_deref().unwrap_or("unknown");
        let content = msg.summary.as_deref()
            .or(msg.content.as_deref())
            .unwrap_or("(empty)");
        let ts = msg.timestamp.as_deref().unwrap_or("");
        lines.push(format!("  [{}] {} -> {}", ts, from, content));
    }

    Ok(CommandResult {
        success: true,
        output: lines.join("\n"),
        result_type: "message_list".to_string(),
        data: serde_json::to_value(&messages).ok(),
    })
}

fn cmd_broadcast(team_name: &str, message: &str) -> Result<CommandResult, String> {
    if message.is_empty() {
        return Ok(CommandResult {
            success: false,
            output: "Usage: /broadcast <message>".to_string(),
            result_type: "error".to_string(),
            data: None,
        });
    }

    let claude_dir = get_claude_dir();
    let team_dir = claude_dir.join("teams").join(team_name);
    let config_path = team_dir.join("config.json");

    if !config_path.exists() {
        return Ok(CommandResult {
            success: false,
            output: format!("Team '{}' not found", team_name),
            result_type: "error".to_string(),
            data: None,
        });
    }

    let config_data = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let config: TeamConfig = serde_json::from_str(&config_data)
        .map_err(|e| format!("Failed to parse team config: {}", e))?;

    let mut succeeded = Vec::new();
    let mut failed = Vec::new();

    for member in &config.members {
        match send_message_to_agent(
            team_name.to_string(),
            member.name.clone(),
            message.to_string(),
            Some("user".to_string()),
        ) {
            Ok(result) if result.success => {
                succeeded.push(member.name.clone());
            }
            Ok(result) => {
                failed.push((member.name.clone(), result.output));
            }
            Err(e) => {
                failed.push((member.name.clone(), e));
            }
        }
    }

    let output = if failed.is_empty() {
        format!("Broadcast sent to {} agents: {}", succeeded.len(), succeeded.join(", "))
    } else if succeeded.is_empty() {
        format!("Broadcast failed for all agents.")
    } else {
        format!(
            "Broadcast partially sent.\n  Succeeded: {}\n  Failed: {}",
            succeeded.join(", "),
            failed.iter().map(|(n, e)| format!("{} ({})", n, e)).collect::<Vec<_>>().join(", "),
        )
    };

    Ok(CommandResult {
        success: !succeeded.is_empty(),
        output,
        result_type: if failed.is_empty() { "success" } else { "info" }.to_string(),
        data: None,
    })
}

fn cmd_history(team_name: &str) -> Result<CommandResult, String> {
    let history = get_terminal_history(team_name.to_string())?;

    if history.is_empty() {
        return Ok(CommandResult {
            success: true,
            output: "No command history.".to_string(),
            result_type: "info".to_string(),
            data: None,
        });
    }

    let mut lines = Vec::new();
    lines.push(format!("Command history ({} entries):", history.len()));
    lines.push(String::new());

    for entry in history.iter().rev().take(20) {
        lines.push(format!("  [{}] {}", entry.timestamp, entry.command));
    }

    Ok(CommandResult {
        success: true,
        output: lines.join("\n"),
        result_type: "info".to_string(),
        data: None,
    })
}

fn cmd_help() -> Result<CommandResult, String> {
    let help_text = r#"Available commands:

  Messages:
    /msg <agent> <message>    Send a message to an agent
    /broadcast <message>      Send message to all agents

  Status:
    /status [agent]           Show team or agent status
    /tasks [filter]           List tasks (filter by status or owner)
    /agents                   List all agents in the team
    /inbox <agent>            View an agent's inbox messages

  Utility:
    /history                  Show command history
    /clear                    Clear terminal output
    /help                     Show this help message

Examples:
  /msg developer Fix the login bug
  /broadcast Code review in 10 minutes
  /status team-lead
  /tasks in_progress
  /inbox researcher"#;

    Ok(CommandResult {
        success: true,
        output: help_text.to_string(),
        result_type: "info".to_string(),
        data: None,
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BroadcastResponse {
    pub total: usize,
    pub succeeded: Vec<String>,
    pub failed: Vec<(String, String)>,
}

#[tauri::command]
fn broadcast_message(team_name: String, message: String) -> Result<BroadcastResponse, String> {
    let claude_dir = get_claude_dir();
    let team_dir = claude_dir.join("teams").join(&team_name);
    let config_path = team_dir.join("config.json");

    if !config_path.exists() {
        return Err(format!("Team '{}' not found", team_name));
    }

    let config_data = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let config: TeamConfig = serde_json::from_str(&config_data)
        .map_err(|e| format!("Failed to parse team config: {}", e))?;

    let total = config.members.len();
    let mut succeeded = Vec::new();
    let mut failed = Vec::new();

    for member in &config.members {
        match send_message_to_agent(
            team_name.clone(),
            member.name.clone(),
            message.clone(),
            Some("user".to_string()),
        ) {
            Ok(result) if result.success => {
                succeeded.push(member.name.clone());
            }
            Ok(result) => {
                failed.push((member.name.clone(), result.output));
            }
            Err(e) => {
                failed.push((member.name.clone(), e));
            }
        }
    }

    Ok(BroadcastResponse {
        total,
        succeeded,
        failed,
    })
}

#[tauri::command]
fn get_terminal_history(team_name: String) -> Result<Vec<TerminalHistoryEntry>, String> {
    let claude_dir = get_claude_dir();
    let history_path = claude_dir.join("teams").join(&team_name).join("terminal_history.json");

    if !history_path.exists() {
        return Ok(vec![]);
    }

    let data = std::fs::read_to_string(&history_path).map_err(|e| e.to_string())?;
    let history: Vec<TerminalHistoryEntry> = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse terminal history: {}", e))?;

    Ok(history)
}

#[tauri::command]
fn save_terminal_history(team_name: String, entry: TerminalHistoryEntry) -> Result<(), String> {
    let claude_dir = get_claude_dir();
    let team_dir = claude_dir.join("teams").join(&team_name);
    let history_path = team_dir.join("terminal_history.json");

    if !team_dir.exists() {
        return Err(format!("Team directory not found: {}", team_name));
    }

    let mut history: Vec<TerminalHistoryEntry> = if history_path.exists() {
        let data = std::fs::read_to_string(&history_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    history.push(entry);

    // Keep only the last 200 entries
    if history.len() > 200 {
        history = history.split_off(history.len() - 200);
    }

    let json = serde_json::to_string_pretty(&history).map_err(|e| e.to_string())?;
    std::fs::write(&history_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_agent_inbox(team_name: String, agent_name: String, limit: Option<usize>) -> Result<Vec<InboxMessage>, String> {
    let claude_dir = get_claude_dir();
    let inboxes_dir = claude_dir.join("teams").join(&team_name).join("inboxes");
    let messages = read_inbox(&inboxes_dir, &agent_name)?;
    let limit = limit.unwrap_or(20);
    Ok(messages.into_iter().take(limit).collect())
}

/// Validate agent name: only alphanumeric and hyphens allowed
fn validate_agent_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Agent name is required".to_string());
    }
    if !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(format!("Invalid agent name '{}': only alphanumeric characters and hyphens allowed", name));
    }
    Ok(())
}

/// Validate message content
fn validate_message(message: &str) -> Result<(), String> {
    if message.trim().is_empty() {
        return Err("Message body cannot be empty".to_string());
    }
    if message.len() > 5000 {
        return Err(format!("Message too long ({} chars). Maximum is 5000 characters.", message.len()));
    }
    Ok(())
}

/// Validate command input
fn validate_command(command: &str) -> Result<(), String> {
    if command.len() > 1000 {
        return Err(format!("Command too long ({} chars). Maximum is 1000 characters.", command.len()));
    }
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
            send_message_to_agent,
            broadcast_message,
            execute_team_command,
            get_agent_inbox,
            get_terminal_history,
            save_terminal_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
