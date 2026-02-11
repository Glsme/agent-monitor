# Agent Monitor

<div align="center">

**Claude Code Agent Team 실시간 시각화 도구**

Claude Code 에이전트 팀의 활동을 픽셀아트 가상 오피스와 대시보드로 모니터링하는 macOS 데스크톱 앱입니다.

[English](./README.md)

<img src="https://img.shields.io/badge/Tauri-v2-blue?style=flat-square" alt="Tauri v2" />
<img src="https://img.shields.io/badge/React-18-61dafb?style=flat-square" alt="React 18" />
<img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square" alt="TypeScript" />
<img src="https://img.shields.io/badge/Rust-2021-dea584?style=flat-square" alt="Rust" />
<img src="https://img.shields.io/badge/Platform-macOS-000000?style=flat-square" alt="macOS" />

</div>

---

## 개요

Claude Code에서 `TeamCreate`로 에이전트 팀을 만들면, Agent Monitor가 자동으로 감지하여 두 가지 뷰를 제공합니다:

- **대시보드 뷰** — 에이전트 카드, 상태 필터, 태스크 목록, 이벤트 타임라인
- **오피스 뷰** — 픽셀아트 캐릭터들이 상태에 따라 방을 이동하는 가상 오피스

앱은 Claude Code의 로컬 데이터 파일(`~/.claude/teams/`, `~/.claude/tasks/`)을 직접 읽으며, 파일 시스템 워칭으로 실시간 업데이트됩니다.

## 주요 기능

- **실시간 모니터링** — 파일 시스템 워처 + 3초 폴링으로 즉각 반영
- **대시보드 뷰** — 에이전트 카드 (상태 뱃지, 진행률, 태스크 할당, 메시지 수)
- **오피스 뷰** — SVG 픽셀아트 오피스 6개 방 (워크스페이스, 회의실, 라운지, 서버룸)
- **애니메이션** — 걷기, 바운스, 말풍선, 상태 표시등 발광
- **상태 필터** — working / idle / blocked / offline 필터링
- **멀티팀 지원** — 드롭다운으로 팀 전환
- **자동 실행** — LaunchAgent 데몬이 팀 생성 시 앱 자동 실행
- **다크 픽셀아트 테마** — 레트로 게임 스타일 UI

## 요구 사항

- **macOS** 10.15+
- **Node.js** 18+
- **Rust** (없으면 자동 설치)
- **Xcode Command Line Tools**

## 설치

### npm (권장)

```bash
npx agent-monitor
```

또는 글로벌 설치:

```bash
npm install -g agent-monitor
agent-monitor install
```

빌드 도구 없이 바로 설치됩니다. 빌드된 바이너리를 다운로드하고 자동 실행을 설정합니다.

### curl

```bash
curl -fsSL https://raw.githubusercontent.com/Glsme/agent-monitor/main/scripts/install.sh | bash
```

빌드된 바이너리를 다운로드하며, 실패 시 소스에서 빌드합니다.

### 소스에서 설치

```bash
git clone https://github.com/Glsme/agent-monitor.git
cd agent-monitor
bash scripts/install.sh
```

### 개발용

```bash
git clone https://github.com/Glsme/agent-monitor.git
cd agent-monitor
npm install
npm run tauri dev
```

## 사용법

### 자동 모드

설치 후 Agent Monitor는 자동으로 동작합니다:

1. 데몬이 `~/.claude/teams/` 디렉토리를 5초마다 감시
2. Claude Code에서 팀을 만들면 (`TeamCreate`) 앱이 자동 실행
3. 헤더의 드롭다운에서 팀 선택
4. **Dashboard** / **Office** 뷰 토글로 전환

### 수동 실행

```bash
open ~/Applications/Agent\ Monitor.app
```

### 뷰 설명

#### 대시보드

| 요소 | 설명 |
|------|------|
| **에이전트 카드** | 이름, 타입, 상태, 현재 태스크, 진행률 표시 |
| **상태 필터** | All / Working / Idle / Blocked 로 필터링 |
| **태스크 목록** | 전체 태스크와 담당자, 상태, 차단 여부 |
| **타임라인** | 시간순 이벤트 피드 (태스크 시작/완료, 메시지) |

에이전트 카드를 클릭하면 해당 에이전트의 태스크와 타임라인만 필터링됩니다.

#### 오피스

| 방 | 배치되는 에이전트 |
|----|------------------|
| **Workspace A/B/C** | 작업 중인 에이전트 (분산 배치) |
| **Meeting Room** | 차단된 에이전트 (블로커 논의 중) |
| **Lounge** | 유휴 에이전트 (태스크 대기) |
| **Server Room** | 오프라인 에이전트 |

에이전트 캐릭터를 클릭하면 하단 패널에 상세 정보가 표시됩니다.

## 데이터 소스

Agent Monitor는 Claude Code의 로컬 파일을 읽습니다:

| 경로 | 내용 |
|------|------|
| `~/.claude/teams/{team}/config.json` | 팀 설정 (이름, 멤버, 역할) |
| `~/.claude/tasks/{team}/{id}.json` | 개별 태스크 데이터 |
| `~/.claude/teams/{team}/inboxes/{agent}.json` | 에이전트 메시지 |

어떤 데이터도 외부로 전송되지 않습니다. 모든 것이 로컬에서 처리됩니다.

## 아키텍처

```
agent-monitor/
├── src-tauri/           # Rust 백엔드
│   └── src/lib.rs       # Tauri 명령: list_teams, get_team_snapshot, watch_team
├── src/
│   ├── types/           # TypeScript 타입 정의
│   ├── hooks/           # useTeamData 훅 (Tauri API + 폴링)
│   ├── components/
│   │   ├── common/      # StatusBadge, Panel, Tooltip, ViewToggle 등
│   │   ├── dashboard/   # AgentCard, StatusFilter, Timeline, TaskList
│   │   └── office/      # PixelAgent, OfficeRoom, OfficeView (SVG)
│   └── App.tsx          # 앱 셸 (뷰 토글, 팀 선택)
├── scripts/
│   ├── install.sh       # 원클릭 설치 스크립트
│   ├── uninstall.sh     # 깔끔한 제거
│   └── agent-monitor-daemon.sh  # 자동 실행 데몬
└── docs/                # 명세서, 데이터 모델, 디자인 시스템, UX, QA
```

## 제거

```bash
# npm으로 설치한 경우
agent-monitor uninstall

# 스크립트로 제거
bash scripts/uninstall.sh

# 수동 제거
launchctl unload ~/Library/LaunchAgents/com.agent-monitor.daemon.plist
rm -rf ~/Applications/Agent\ Monitor.app
rm -rf ~/.agent-monitor
rm ~/Library/LaunchAgents/com.agent-monitor.daemon.plist
```

## 기술 스택

| 레이어 | 기술 |
|--------|-----|
| **데스크톱 프레임워크** | Tauri v2 |
| **백엔드** | Rust (serde, notify, tauri-plugin-fs) |
| **프론트엔드** | React 18 + TypeScript |
| **스타일링** | Tailwind CSS |
| **그래픽** | SVG (pixel art) |
| **빌드** | Vite |

## 라이선스

MIT

## 기여

기여를 환영합니다! PR을 제출하기 전에 `docs/` 디렉토리의 아키텍처 문서를 참고해주세요.
