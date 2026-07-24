import {
  AlertCircle,
  Check,
  CircleStop,
  Clipboard,
  Code2,
  FileText,
  Headphones,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  ScanLine,
  Sparkles,
  Volume2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { CodingLanguage } from '../../../shared/contracts'
import type {
  DesktopActions,
  DesktopViewModel,
} from '../model/desktopModel'
import { AudioMeter } from './components/AudioMeter'
import { CaptureNotice } from './components/CaptureNotice'

interface LiveViewProps {
  model: DesktopViewModel
  actions: DesktopActions
}

export function LiveView({ model, actions }: LiveViewProps) {
  return (
    <main className="desktop-content live-content">
      <div className="interview-mode-bar">
        <div
          className="interview-mode-switcher"
          role="group"
          aria-label="Assistant mode"
        >
          <button
            className={model.interviewMode === 'general' ? 'active' : ''}
            type="button"
            disabled={model.modeSwitchDisabled}
            onClick={() => actions.selectInterviewMode('general')}
          >
            <MessageSquareText size={14} aria-hidden="true" />
            Interview
          </button>
          <button
            className={model.interviewMode === 'coding' ? 'active' : ''}
            type="button"
            disabled={model.modeSwitchDisabled}
            onClick={() => actions.selectInterviewMode('coding')}
          >
            <Code2 size={14} aria-hidden="true" />
            Coding
          </button>
        </div>
        {model.interviewMode === 'coding' && (
          <label className="coding-language-picker">
            <span>Language</span>
            <select
              value={model.codingLanguage}
              onChange={(event) =>
                actions.setCodingLanguage(
                  event.target.value as CodingLanguage,
                )
              }
            >
              {model.codingLanguages.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <section className="capture-card">
        <div className="capture-topline">
          <div>
            <span
              className={`capture-dot capture-${model.captureState}`}
            />
            <strong>
              {model.captureState === 'listening'
                ? 'Listening to system audio'
                : model.captureState === 'starting'
                  ? 'Starting capture'
                  : 'Capture is idle'}
            </strong>
          </div>
          <AudioMeter level={model.audioLevel} />
        </div>

        <div className="capture-actions">
          {model.captureState === 'listening' ? (
            <button
              className="desktop-stop-button"
              type="button"
              onClick={() => void actions.stopCapture()}
            >
              <CircleStop size={16} aria-hidden="true" />
              Stop listening
            </button>
          ) : (
            <button
              className="desktop-primary-button"
              type="button"
              disabled={
                !model.runtimeReady || model.captureState === 'starting'
              }
              onClick={() => void actions.startCapture()}
            >
              {model.captureState === 'starting' ? (
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
              ) : (
                <Headphones size={16} aria-hidden="true" />
              )}
              Start listening
            </button>
          )}
          <button
            className="desktop-secondary-button"
            type="button"
            disabled={model.answerState === 'generating'}
            onClick={() => void actions.answerFromScreen()}
          >
            <ScanLine size={16} aria-hidden="true" />
            Read screen
          </button>
        </div>

        <label className="auto-answer-toggle">
          <input
            type="checkbox"
            checked={model.autoAnswer}
            onChange={(event) => actions.setAutoAnswer(event.target.checked)}
          />
          <span />
          {model.interviewMode === 'coding'
            ? 'Auto-solve detected coding prompts'
            : 'Auto-answer detected questions'}
        </label>

        {(model.captureError || model.modelProgress) && (
          <CaptureNotice
            error={model.captureError}
            progress={model.modelProgress}
          />
        )}
      </section>

      <section className="transcript-card">
        <div className="desktop-section-heading">
          <div>
            <Volume2 size={15} aria-hidden="true" />
            <h2>Live transcript</h2>
          </div>
          <div className="transcript-actions">
            {model.transcribing && (
              <span className="working-label">
                <LoaderCircle className="spin" size={12} aria-hidden="true" />
                Whisper
              </span>
            )}
            {model.latestTranscript && (
              <button
                type="button"
                onClick={actions.useLatestTranscript}
              >
                Use latest
              </button>
            )}
          </div>
        </div>
        <div
          className={`transcript-body ${model.transcript ? '' : 'empty'}`}
        >
          {model.transcript ||
            'Start listening. Completed speech segments will appear here.'}
        </div>
      </section>

      <section className="desktop-question-card">
        <div className="desktop-section-heading">
          <div>
            <FileText size={15} aria-hidden="true" />
            <h2>
              {model.interviewMode === 'coding'
                ? 'Detected coding prompt'
                : 'Detected question'}
            </h2>
          </div>
          {model.screenAttached && (
            <span className="screen-attached">
              <Check size={12} aria-hidden="true" />
              Screen attached
            </span>
          )}
        </div>
        <textarea
          value={model.question}
          rows={3}
          placeholder={
            model.interviewMode === 'coding'
              ? 'A detected or typed coding problem…'
              : 'A detected or typed interview question…'
          }
          onChange={(event) => actions.setQuestion(event.target.value)}
        />
        <button
          className="desktop-answer-button"
          type="button"
          disabled={!model.canGenerate}
          onClick={() => void actions.generateAnswer()}
        >
          <Sparkles size={15} aria-hidden="true" />
          {model.interviewMode === 'coding'
            ? 'Solve with Copilot'
            : 'Answer with Copilot'}
        </button>
      </section>

      <section className="desktop-answer-card" aria-live="polite">
        <div className="desktop-section-heading answer-heading">
          <div>
            <Sparkles size={15} aria-hidden="true" />
            <h2>
              {model.interviewMode === 'coding'
                ? 'Coding solution'
                : 'Suggested answer'}
            </h2>
          </div>
          {model.answer && (
            <div className="desktop-answer-tools">
              <span>{model.answerWords} words</span>
              <button
                type="button"
                onClick={() => void actions.copyAnswer()}
              >
                {model.copied ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Clipboard size={13} aria-hidden="true" />
                )}
                {model.copied ? 'Copied' : 'Copy'}
              </button>
              <button type="button" onClick={actions.clearAnswer}>
                <RotateCcw size={13} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {(model.answerState === 'capturing' ||
          model.answerState === 'generating') &&
          !model.answer && (
            <div className="desktop-answer-loading">
              <LoaderCircle className="spin" size={17} aria-hidden="true" />
              {model.answerState === 'capturing'
                ? model.interviewMode === 'coding'
                  ? 'Reading the coding problem…'
                  : 'Reading the meeting screen…'
                : model.interviewMode === 'coding'
                  ? 'Copilot is solving the problem…'
                  : 'Copilot is drafting a grounded answer…'}
            </div>
          )}

        {model.answer ? (
          <div className="desktop-markdown">
            <ReactMarkdown>{model.answer}</ReactMarkdown>
            {model.answerState === 'generating' && (
              <span className="stream-cursor" aria-hidden="true" />
            )}
          </div>
        ) : model.answerState === 'idle' ? (
          <div className="desktop-answer-empty">
            Answers will stream here while the overlay stays above your
            {model.interviewMode === 'coding'
              ? ' coding workspace.'
              : ' meeting window.'}
          </div>
        ) : null}

        {model.answerState === 'error' && (
          <div className="desktop-error" role="alert">
            <AlertCircle size={15} aria-hidden="true" />
            {model.answerError}
          </div>
        )}

        {model.answerState === 'generating' && (
          <button
            className="cancel-generation"
            type="button"
            onClick={() => void actions.stopAnswer()}
          >
            Stop generation
          </button>
        )}
      </section>
    </main>
  )
}
