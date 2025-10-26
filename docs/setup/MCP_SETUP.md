# shadcn MCP Server Setup Guide

## 개요
이 문서는 shadcn/ui 컴포넌트를 관리하기 위한 MCP(Model Context Protocol) 서버 설정 방법을 설명합니다.

## 설치 완료 사항

### 1. MCP 서버 구조
```
aed-check-system/
├── mcp-server/
│   ├── index.js         # MCP 서버 메인 파일
│   └── package.json     # 서버 종속성
└── .mcp.json           # MCP 설정 파일
```

### 2. 서버 기능
MCP 서버는 다음 3가지 주요 기능을 제공합니다:

1. **init_shadcn**: shadcn/ui를 프로젝트에 초기화
2. **add_component**: 특정 shadcn/ui 컴포넌트 추가
3. **list_components**: 사용 가능한 컴포넌트 목록 조회

### 3. 사용 방법

#### 서버 실행 (테스트용)
```bash
cd mcp-server
node index.js
```

#### Claude Desktop에서 사용
Claude Desktop 앱의 설정에서 다음을 추가:
```json
{
  "mcpServers": {
    "shadcn": {
      "command": "node",
      "args": ["./mcp-server/index.js"],
      "cwd": "/Users/kwangsunglee/Projects/AED_check2025/aed-check-system"
    }
  }
}
```

### 4. 컴포넌트 추가 예시

프로젝트에 shadcn/ui 컴포넌트를 추가하려면:

```bash
# 수동으로 추가
npx shadcn@latest add button

# MCP 서버를 통해 추가 (Claude Desktop에서)
# "Add shadcn button component" 명령
```

### 5. 사용 가능한 컴포넌트

- accordion
- alert
- alert-dialog
- avatar
- badge
- breadcrumb
- button
- calendar
- card
- carousel
- checkbox
- collapsible
- combobox
- command
- context-menu
- data-table
- date-picker
- dialog
- drawer
- dropdown-menu
- form
- hover-card
- input
- label
- menubar
- navigation-menu
- pagination
- popover
- progress
- radio-group
- resizable
- scroll-area
- select
- separator
- sheet
- skeleton
- slider
- sonner
- switch
- table
- tabs
- textarea
- toast
- toggle
- toggle-group
- tooltip

## 주의사항

1. Node.js 18 이상 필요
2. 프로젝트에 Next.js와 Tailwind CSS가 설치되어 있어야 함
3. 처음 사용 시 `npx shadcn@latest init` 실행 필요

## 문제 해결

### 서버가 실행되지 않을 때
```bash
# 종속성 재설치
cd mcp-server
npm install

# 권한 문제 해결
chmod +x index.js
```

### 컴포넌트 추가 실패 시
1. components.json 파일이 프로젝트 루트에 있는지 확인
2. 없다면 `npx shadcn@latest init` 실행