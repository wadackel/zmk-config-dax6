// DT (DeviceTree) lexer for ZMK `.keymap` files.
//
// Produces a flat token stream with byte ranges (UTF-16 code units, i.e. JS
// string indices). Whitespace and newlines are emitted as tokens so callers
// that need byte-preserving rewriting can reassemble the original text.

import type { Range, Token, TokenKind } from './types'

const isLetter = (c: string) =>
  (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'
const isDigit = (c: string) => c >= '0' && c <= '9'
const isIdent = (c: string) => isLetter(c) || isDigit(c) || c === '-' || c === '.' || c === '#'

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  const push = (kind: TokenKind, start: number, end: number) => {
    tokens.push({ kind, value: source.slice(start, end), range: [start, end] as Range })
  }

  while (i < source.length) {
    const c = source[i]

    // Newlines (emit separately so that line comments + serializer can preserve layout).
    if (c === '\n') {
      push('newline', i, i + 1)
      i++
      continue
    }
    if (c === '\r') {
      const end = source[i + 1] === '\n' ? i + 2 : i + 1
      push('newline', i, end)
      i = end
      continue
    }

    // Whitespace runs (spaces + tabs).
    if (c === ' ' || c === '\t') {
      const start = i
      while (i < source.length && (source[i] === ' ' || source[i] === '\t')) i++
      push('whitespace', start, i)
      continue
    }

    // Preprocessor directives: `#define ...`, `#include ...`. Consume up to (not
    // including) the newline. Line-continuation `\` followed by newline keeps
    // the directive going.
    if (c === '#' && (i === 0 || /[\r\n]/.test(source[i - 1]))) {
      const start = i
      while (i < source.length) {
        const ch = source[i]
        if (ch === '\n' || ch === '\r') {
          // Check for line continuation: previous non-space char on this line
          // must be `\`.
          let j = i - 1
          while (j >= start && (source[j] === ' ' || source[j] === '\t')) j--
          if (j >= start && source[j] === '\\') {
            // Consume the newline and keep going.
            i += source[i] === '\r' && source[i + 1] === '\n' ? 2 : 1
            continue
          }
          break
        }
        i++
      }
      push('preproc', start, i)
      continue
    }

    // Line comment.
    if (c === '/' && source[i + 1] === '/') {
      const start = i
      i += 2
      while (i < source.length && source[i] !== '\n' && source[i] !== '\r') i++
      push('line-comment', start, i)
      continue
    }

    // Block comment.
    if (c === '/' && source[i + 1] === '*') {
      const start = i
      i += 2
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++
      i += 2 // consume closing `*/`
      push('block-comment', start, Math.min(i, source.length))
      continue
    }

    // String literal (double-quoted).
    if (c === '"') {
      const start = i
      i++
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\') i++
        i++
      }
      i++ // consume closing quote
      push('string', start, i)
      continue
    }

    // Punctuation.
    const single = punctKind(c)
    if (single) {
      push(single, i, i + 1)
      i++
      continue
    }

    // Number (decimal / hex).
    if (isDigit(c)) {
      const start = i
      if (c === '0' && (source[i + 1] === 'x' || source[i + 1] === 'X')) {
        i += 2
        while (i < source.length && /[0-9a-fA-F]/.test(source[i])) i++
      } else {
        while (i < source.length && isDigit(source[i])) i++
      }
      push('number', start, i)
      continue
    }

    // Identifier (DT property names allow `-`, `,`, `#`, `.`).
    if (isLetter(c) || c === '#') {
      const start = i
      i++
      while (i < source.length && (isIdent(source[i]) || source[i] === ',')) i++
      push('identifier', start, i)
      continue
    }

    // Unknown character: skip 1 to avoid infinite loop. DT spec allows a few
    // odd chars in macros — they reappear as the lexer recovers.
    i++
  }

  return tokens
}

function punctKind(c: string): TokenKind | null {
  switch (c) {
    case '{':
      return 'lbrace'
    case '}':
      return 'rbrace'
    case '<':
      return 'langle'
    case '>':
      return 'rangle'
    case '(':
      return 'lparen'
    case ')':
      return 'rparen'
    case ';':
      return 'semi'
    case ':':
      return 'colon'
    case '=':
      return 'equals'
    case '&':
      return 'ampersand'
    case ',':
      return 'comma'
    case '/':
      return 'slash'
    default:
      return null
  }
}

/** Skip whitespace, newlines, and comments. Returns the next significant token index, or -1. */
export function skipTrivia(tokens: Token[], from: number): number {
  let i = from
  while (i < tokens.length) {
    const k = tokens[i].kind
    if (k === 'whitespace' || k === 'newline' || k === 'line-comment' || k === 'block-comment') {
      i++
      continue
    }
    return i
  }
  return -1
}
