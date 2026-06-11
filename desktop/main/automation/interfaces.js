// interfaces.js — automation モジュール間のインターフェース契約（W1で固定）
//
// このファイルは型定義とドキュメントのみ。実装は各モジュール（W2〜W6）が担う。
// 並列実装の前提となる「境界」を一箇所に集約し、サブエージェント分担時の齟齬を防ぐ。
//
// 【座標系の鉄則】
//   automation 内部のすべての座標は「物理ピクセル（physical px）」で統一する。
//   - ocr.ps1 / desktopCapturer のサムネイル / SetCursorPos はすべて物理px。
//   - 既存 steps[].x/y は記録時の論理px。読み込み時に scaleFactor を掛けて
//     物理pxへ変換する（変換は matcher.js の toPhysical() に一元化）。
//
// 【アクション語彙のホワイトリスト】
//   実行エンジン・AIフォールバック・NLエディタが扱えるアクションは下記のみ。
//   任意コマンド実行・ファイル操作・URLオープンは禁止（プロンプトインジェクション対策）。

/** @typedef {'click'|'type'|'scroll'|'key'|'wait'} ActionType */

/**
 * フロー（自動実行の単位）。flow.json の形。
 * @typedef {Object} Flow
 * @property {string} id            - UUID
 * @property {string} name          - 表示名
 * @property {string} [manualId]    - 紐づく Supabase manuals.id（任意）
 * @property {Step[]} steps
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * ステップ。記録時に作られ、実行時に解釈される。
 * @typedef {Object} Step
 * @property {number} stepNumber
 * @property {ActionType} action          - 既定 'click'
 * @property {number} x                   - 記録時クリックX（物理px）
 * @property {number} y                   - 記録時クリックY（物理px）
 * @property {number} viewportWidth       - 記録時画面幅（物理px）
 * @property {number} viewportHeight      - 記録時画面高（物理px）
 * @property {string} [label]             - 人間可読のステップ名
 * @property {string} [memo]
 * @property {string} [ocrContext]        - クリック周辺のOCRテキスト（アンカー）
 * @property {string} [inputText]         - type時の入力値（秘匿時はnull、ローカルのみ）
 * @property {boolean} [isSecret]         - パスワード等。実行時は手動入力待ち
 * @property {string} [windowTitle]       - 対象ウィンドウタイトル
 * @property {string} [processName]       - 対象プロセス名
 * @property {UiaInfo} [uia]              - 記録時のUI構造情報（第1階層特定に使用）
 * @property {string} [successCriteria]   - 成功条件（②AI結果検証・Phase 3）
 * @property {boolean} [promptAtRuntime]  - 実行時に入力を尋ねる（Phase 2）
 * @property {string} [screenshotFile]    - step-N.png の相対パス
 */

/**
 * UI Automation 要素情報。
 * @typedef {Object} UiaInfo
 * @property {string} [name]
 * @property {string} [controlType]   - 'Button'|'Edit'|'ComboBox'|'MenuItem' 等
 * @property {string} [automationId]
 * @property {string} [className]
 * @property {string[]} [path]        - 親要素の連鎖（祖先のName/ControlType）
 * @property {boolean} [isPassword]
 */

/**
 * 要素特定の結果。各階層（UIA/OCR/AI）が返す共通形。
 * @typedef {Object} LocateResult
 * @property {number} x               - クリック先X（物理px）
 * @property {number} y               - クリック先Y（物理px）
 * @property {number} confidence      - 0..1
 * @property {'uia'|'ocr'|'ai'} method
 * @property {string} [reason]
 */

// ── input-driver.js（W2）──────────────────────────────────────────────────
/**
 * @typedef {Object} InputDriver
 * @property {() => Promise<void>} init           - 常駐ワーカー起動
 * @property {() => Promise<void>} dispose
 * @property {(x:number,y:number) => Promise<void>} move
 * @property {(x:number,y:number,button?:'left'|'right') => Promise<void>} click
 * @property {(text:string) => Promise<void>} type    - KEYEVENTF_UNICODE（IME非依存）
 * @property {(vk:string) => Promise<void>} key       - 'enter'|'tab'|'esc' 等
 * @property {(delta:number) => Promise<void>} scroll
 * @property {(q:{titleSubstr?:string,processName?:string}) => Promise<boolean>} activate
 * @property {() => Promise<{title:string,processName:string,hwnd:number}>} foreground
 * @property {(path:string) => Promise<void>} launch
 * @property {(x:number,y:number) => Promise<UiaInfo|null>} uiaInspect
 * @property {(uia:UiaInfo) => Promise<{rect:{x:number,y:number,w:number,h:number},score:number}|null>} uiaFind
 * @property {(opts?:{maxDepth?:number}) => Promise<string>} uiaTreeSummary
 */

// ── screen-reader.js（W3）─────────────────────────────────────────────────
/**
 * @typedef {Object} ScreenReader
 * @property {() => Promise<{dataUrl:string,width:number,height:number,scaleFactor:number}>} capture
 * @property {(dataUrl?:string) => Promise<{words:{text:string,x:number,y:number,w:number,h:number}[]}>} ocr
 */

// ── matcher.js（W3・純関数）───────────────────────────────────────────────
/**
 * @typedef {Object} Matcher
 * @property {(step:Step, scaleFactor:number) => {x:number,y:number}} toPhysical  - 論理px→物理px変換（一元化）
 * @property {(step:Step, uiaFind:Function) => Promise<LocateResult|null>} matchByUia
 * @property {(step:Step, currentWords:object[], curSize:{w:number,h:number}) => LocateResult|null} matchByOcr
 */

// ── ai-fallback.js（W4）───────────────────────────────────────────────────
/**
 * @typedef {Object} AiAction
 * @property {'click'|'type'|'scroll'|'wait'|'fail'} action
 * @property {number} [x]   - 0..1000 正規化
 * @property {number} [y]   - 0..1000 正規化
 * @property {string} [text]
 * @property {number} confidence
 * @property {string} reason
 */
/**
 * @typedef {Object} AiFallback
 * @property {(ctx:{screenshotDataUrl:string,recordedCropDataUrl?:string,step:Step,uiaTreeText?:string}) => Promise<AiAction>} decideNextAction
 * @property {(ctx:{screenshotDataUrl:string,successCriteria:string,step:Step}) => Promise<{status:'success'|'fail'|'uncertain',reason:string}>} verifyResult
 */

// ── safety.js（W5）────────────────────────────────────────────────────────
/**
 * @typedef {Object} Safety
 * @property {RegExp} DANGER_RE
 * @property {(step:Step) => boolean} isDangerous
 * @property {(action:{action:string}) => {allowed:boolean,reason?:string}} checkAction  - ホワイトリスト検証
 * @property {(cb:() => void) => void} registerEmergencyStop   - Esc登録
 * @property {() => void} unregisterEmergencyStop
 */

// ── replay-engine.js（W5）─────────────────────────────────────────────────
/**
 * @typedef {'step_by_step'|'supervised'|'unattended'} RunMode
 * @typedef {Object} RunOptions
 * @property {RunMode} mode
 * @property {(p:{stepNumber:number,total:number,phase:string}) => void} [onProgress]
 * @property {(opts:{message:string,danger?:boolean}) => Promise<boolean>} [onConfirm]
 * @property {(step:Step) => Promise<string>} [onRuntimeInput]   - promptAtRuntime用（Phase 2）
 * @property {() => boolean} [shouldAbort]
 */
/**
 * @typedef {Object} ReplayEngine
 * @property {(flow:Flow, opts:RunOptions) => Promise<{status:'success'|'aborted'|'failed',results:object[]}>} run
 */

// ── flow-store.js（W1・本ファイルと同時に実装）────────────────────────────
/**
 * @typedef {Object} FlowStore
 * @property {() => Flow[]} listFlows
 * @property {(id:string) => Flow|null} getFlow
 * @property {(flow:Partial<Flow>) => string} saveFlow          - id返す（新規/上書き）
 * @property {(id:string) => void} deleteFlow
 * @property {(id:string, idx:number, patch:Partial<Step>) => void} updateStep
 * @property {(id:string, ops:object[]) => void} applyOps       - NLエディタ用（Phase 2）
 * @property {(id:string) => void} backup
 * @property {(id:string) => boolean} restore
 */

/** ホワイトリスト（実行可能アクション種別） */
const ALLOWED_ACTIONS = Object.freeze(['click', 'type', 'scroll', 'key', 'wait']);

module.exports = { ALLOWED_ACTIONS };
