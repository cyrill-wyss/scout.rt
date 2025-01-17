/*
 * Copyright (c) 2014-2017 BSI Business Systems Integration AG.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     BSI Business Systems Integration AG - initial API and implementation
 */
import {keys, KeyStrokeContext, keyStrokeModifier} from '../index';
import $ from 'jquery';

/**
 * Keystroke context used for input fields.
 */
export default class InputFieldKeyStrokeContext extends KeyStrokeContext {

  constructor() {
    super();

    this.invokeAcceptInputOnActiveValueField = true;

    this.registerStopPropagationKeys(keyStrokeModifier.CTRL, [
      keys.A,
      keys.C,
      keys.Y,
      keys.V,
      keys.Z,
      keys.RIGHT,
      keys.BACKSPACE,
      keys.LEFT,
      keys.HOME,
      keys.END,
      keys.NUMPAD_4,
      keys.NUMPAD_6
    ]);

    this.registerStopPropagationKeys(keyStrokeModifier.CTRL | keyStrokeModifier.SHIFT, [ // NOSONAR
      keys.RIGHT,
      keys.BACKSPACE,
      keys.LEFT,
      keys.HOME,
      keys.END,
      keys.NUMPAD_4,
      keys.NUMPAD_6
    ]);

    this.registerStopPropagationKeys(keyStrokeModifier.SHIFT, [
      keys.RIGHT,
      keys.BACKSPACE,
      keys.LEFT,
      keys.HOME,
      keys.END,
      keys.NUMPAD_4,
      keys.NUMPAD_6
    ]);
    this.registerStopPropagationKeys(keyStrokeModifier.NONE, [
      keys.SEMICOLON,
      keys.DASH,
      keys.COMMA,
      keys.POINT,
      keys.FORWARD_SLASH,
      keys.OPEN_BRACKET,
      keys.BACK_SLASH,
      keys.CLOSE_BRACKET,
      keys.SINGLE_QUOTE,
      keys.MULTIPLY,
      keys.ADD,
      keys.SUBTRACT,
      keys.DECIMAL_POINT,
      keys.DIVIDE,
      keys.NUMPAD_0,
      keys.NUMPAD_1,
      keys.NUMPAD_2,
      keys.NUMPAD_3,
      keys.NUMPAD_4,
      keys.NUMPAD_5,
      keys.NUMPAD_6,
      keys.NUMPAD_7,
      keys.NUMPAD_8,
      keys.NUMPAD_9,
      keys.MULTIPLY,
      keys.END,
      keys.HOME,
      keys.RIGHT,
      keys.BACKSPACE,
      keys.LEFT,
      keys.DELETE,
      keys.SPACE
    ]);
  }

  _applyPropagationFlags(event) {
    super._applyPropagationFlags(event);

    if (event.isPropagationStopped()) {
      return;
    }

    if (this._isInputField(event.target) && (this._isLetterKeyStroke(event) || this._isNumberKeyStroke(event))) {
      event.stopPropagation();
    }
  }

  _isInputField(element) {
    if (element && element.isContentEditable) {
      return true;
    }
    let $element = $(element);
    return $element.is('input:text') || $element.is('input:file') || $element.is('textarea');
  }

  _isNumberKeyStroke(event) {
    return !event.ctrlKey && event.which >= keys[0] && event.which <= keys[9];
  }

  _isLetterKeyStroke(event) {
    return !event.ctrlKey && event.which >= keys.A && event.which <= keys.Z;
  }
}
