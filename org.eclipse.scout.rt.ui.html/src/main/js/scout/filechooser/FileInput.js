/*******************************************************************************
 * Copyright (c) 2014-2018 BSI Business Systems Integration AG.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     BSI Business Systems Integration AG - initial API and implementation
 ******************************************************************************/
scout.FileInput = function() {
  scout.FileInput.parent.call(this);
  this.acceptTypes = null;
  this.maximumUploadSize = scout.FileInput.DEFAULT_MAXIMUM_UPLOAD_SIZE;
  this.multiSelect = false;
  this.files = [];
  this.legacyFileUploadUrl = null;
  this.text = null;
};
scout.inherits(scout.FileInput, scout.Widget);

scout.FileInput.DEFAULT_MAXIMUM_UPLOAD_SIZE = 50 * 1024 * 1024; // 50 MB

scout.FileInput.prototype._init = function(model) {
  scout.FileInput.parent.prototype._init.call(this, model);
  this.uploadController = model.uploadController || model.parent;
  var url = new scout.URL(model.legacyFileUploadUrl || 'upload/' + this.session.uiSessionId + '/' + this.uploadController.id);
  url.setParameter('legacy', true);
  this.legacyFileUploadUrl = url.toString();
  this.legacy = !scout.device.supportsFile();
};

/**
 * @override
 */
scout.FileInput.prototype._initKeyStrokeContext = function() {
  // Need to create keystroke context here because this.legacy is not set at the time the constructor is executed
  this.keyStrokeContext = this._createKeyStrokeContext();
  scout.Widget.prototype._initKeyStrokeContext.call(this);
};

scout.FileInput.prototype._createKeyStrokeContext = function() {
  if (this.legacy) {
    // native input control is a text field -> use input field context to make sure backspace etc. does not bubble up
    return new scout.InputFieldKeyStrokeContext();
  }
};

scout.FileInput.prototype._render = function() {
  this.$fileInput = this.$parent.makeElement('<input>')
    .attr('type', 'file')
    .on('change', this._onFileChange.bind(this));

  if (!this.legacy) {
    this.$container = this.$parent.appendDiv('file-input input-field');
    this.$fileInput.appendTo(this.$container);
    this.$container.on('mousedown', this._onMouseDown.bind(this));
    this.$text = this.$container.appendDiv('file-input-text');
  } else {
    this._renderLegacyMode();
  }

  if (this.legacy) {
    // Files may not be set into native control -> clear list in order to be sync again
    this.clear();
  }
};

scout.FileInput.prototype._renderLegacyMode = function() {
  this.$legacyFormTarget = this.$fileInput.appendElement('<iframe>')
    .attr('name', 'legacyFileUpload' + this.uploadController.id)
    .on('load', function() {
      // Manually handle JSON response from iframe
      try {
        // "onAjaxDone"
        var text = this.$legacyFormTarget.contents().text();
        if (scout.strings.hasText(text)) {
          // Manually handle JSON response
          var json = $.parseJSON(text);
          this.session.responseQueue.process(json);
        }
      } finally {
        // "onAjaxAlways"
        this.session.setBusy(false);
      }
    }.bind(this));
  this.$fileInput
    .attr('name', 'file')
    .addClass('legacy-upload-file-input');
  this.$legacyForm = this.$parent.appendElement('<form>', 'legacy-upload-form')
    .attr('action', this.legacyFileUploadUrl)
    .attr('enctype', 'multipart/form-data')
    .attr('method', 'post')
    .attr('target', 'legacyFileUpload' + this.uploadController.id)
    .append(this.$fileInput);
  this.$container = this.$legacyForm;
};

scout.FileInput.prototype._renderProperties = function() {
  scout.FileInput.parent.prototype._renderProperties.call(this);
  this._renderText();
  this._renderAcceptTypes();
  this._renderMultiSelect();
};

scout.FileInput.prototype._renderEnabled = function() {
  scout.FileInput.parent.prototype._renderEnabled.call(this);
  this._installOrUninstallDragAndDropHandler();

  if (this.legacy) {
    this.$fileInput.setEnabled(this.enabled);
  } else {
    this.$container.setTabbable(this.enabled);
  }
};

scout.FileInput.prototype.setText = function(text) {
  this.setProperty('text', text);
};

scout.FileInput.prototype._createDragAndDropHandler = function() {
  return scout.dragAndDrop.handler(this, {
    supportedScoutTypes: scout.dragAndDrop.SCOUT_TYPES.FILE_TRANSFER,
    validateFiles: function() {
    },
    onDrop: function(event) {
      if (event.files.length >= 1) {
        this._setFiles(event.files);
      }
    }.bind(this),
    dropType: function() {
      return scout.dragAndDrop.SCOUT_TYPES.FILE_TRANSFER;
    },
    dropMaximumSize: function() {
      return this.maximumUploadSize;
    }.bind(this)
  });
};

scout.FileInput.prototype._installOrUninstallDragAndDropHandler = function() {
  if (this.enabledComputed) {
    this._installDragAndDropHandler();
  } else {
    this._uninstallDragAndDropHandler();
  }
};

scout.FileInput.prototype._installDragAndDropHandler = function() {
  if (this.dragAndDropHandler) {
    return;
  }
  this.dragAndDropHandler = this._createDragAndDropHandler();
  if (!this.dragAndDropHandler) {
    return;
  }
  this.dragAndDropHandler.install(this.$container);
};

scout.FileInput.prototype._uninstallDragAndDropHandler = function() {
  if (!this.dragAndDropHandler) {
    return;
  }
  this.dragAndDropHandler.uninstall();
  this.dragAndDropHandler = null;
};

scout.FileInput.prototype._renderText = function() {
  if (this.legacy) {
    return;
  }
  var text = this.text || '';
  this.$text.text(text);
};

scout.FileInput.prototype.setAcceptTypes = function(acceptTypes) {
  this.setProperty('acceptTypes', acceptTypes);
};

scout.FileInput.prototype._renderAcceptTypes = function() {
  var acceptTypes = this.acceptTypes || '';
  this.$fileInput.attr('accept', acceptTypes);
};

scout.FileInput.prototype.setMultiSelect = function(multiSelect) {
  this.setProperty('multiSelect', multiSelect);
};

scout.FileInput.prototype._renderMultiSelect = function() {
  this.$fileInput.prop('multiple', this.multiSelect);
};

scout.FileInput.prototype.setMaximumUploadSize = function(maximumUploadSize) {
  this.setProperty('maximumUploadSize', maximumUploadSize);
};

scout.FileInput.prototype.clear = function() {
  this._setFiles([]);
  // _setFiles actually sets the text as well, but only if files have changed.
  // Make sure text is cleared as well if there are no files but a text set.
  this.setText(null);
  if (this.rendered) {
    this.$fileInput.val(null);
  }
};

scout.FileInput.prototype._setFiles = function(files) {
  if (files instanceof FileList) {
    files = scout.FileInput.fileListToArray(files);
  }
  files = scout.arrays.ensure(files);
  if (scout.arrays.equals(this.files, files)) {
    return;
  }
  var name = '';
  if (files.length > 0) {
    if (this.legacy) {
      name = files[0];
    } else {
      name = files[0].name;
    }
  }
  this.files = files;
  this.setText(name);
  this.trigger('change', {
    files: files
  });
};

scout.FileInput.prototype.upload = function() {
  if (this.files.length === 0) {
    return true;
  }
  if (!this.legacy) {
    return this.session.uploadFiles(this.uploadController, this.files, undefined, this.maximumUploadSize);
  }
  this.session.setBusy(true);
  this.$legacyForm[0].submit();
  return true;
};

scout.FileInput.prototype.browse = function() {
  // Trigger browser's file chooser
  this.$fileInput.click();
};

scout.FileInput.prototype._onFileChange = function(event) {
  var files = [];

  if (!this.legacy) {
    files = this.$fileInput[0].files;
  } else {
    if (this.$fileInput[0].value) {
      files.push(this.$fileInput[0].value);
    }
  }
  if (files.length) {
    this._setFiles(files);
  }
};

scout.FileInput.prototype._onMouseDown = function() {
  if (!this.enabled) {
    return;
  }
  this.browse();
};

scout.FileInput.fileListToArray = function(fileList) {
  var files = [],
    i;
  for (i = 0; i < fileList.length; i++) {
    files.push(fileList[i]);
  }
  return files;
};

scout.FileInput.prototype.validateMaximumUploadSize = function(files) {
  if (!scout.files.validateMaximumUploadSize(files, this.maximumUploadSize)) {
    throw this.session.text('ui.FileSizeLimit', (this.maximumUploadSize / 1024 / 1024));
  }
};
