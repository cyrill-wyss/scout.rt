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
scout.FileChooser = function() {
  scout.FileChooser.parent.call(this);
  this.displayParent = null;
  this.files = [];
  this._glassPaneRenderer = null;
  this.maximumUploadSize = scout.FileInput.DEFAULT_MAXIMUM_UPLOAD_SIZE;
};
scout.inherits(scout.FileChooser, scout.Widget);

scout.FileChooser.prototype._init = function(model) {
  scout.FileChooser.parent.prototype._init.call(this, model);
  this._setDisplayParent(this.displayParent);
  this._glassPaneRenderer = new scout.GlassPaneRenderer(this);
  this.fileInput = scout.create('FileInput', {
    parent: this,
    acceptTypes: this.acceptTypes,
    maximumUploadSize: this.maximumUploadSize,
    multiSelect: this.multiSelect,
    visible: !scout.device.supportsFile()
  });
  this.fileInput.on('change', this._onFileChange.bind(this));
};

/**
 * @override
 */
scout.FileChooser.prototype._createKeyStrokeContext = function() {
  return new scout.KeyStrokeContext();
};

/**
 * @override
 */
scout.FileChooser.prototype._initKeyStrokeContext = function() {
  scout.FileChooser.parent.prototype._initKeyStrokeContext.call(this);

  this.keyStrokeContext.registerKeyStroke([
    new scout.FocusAdjacentElementKeyStroke(this.session, this),
    new scout.ClickActiveElementKeyStroke(this, [
      scout.keys.SPACE, scout.keys.ENTER
    ]),
    new scout.CloseKeyStroke(this, function() {
      return this.$cancelButton;
    }.bind(this))
  ]);
};

scout.FileChooser.prototype._render = function() {
  this.$container = this.$parent.appendDiv('file-chooser')
    .on('mousedown', this._onMouseDown.bind(this));
  var $handle = this.$container.appendDiv('drag-handle');
  this.$container.draggable($handle);

  this.$container.appendDiv('closable')
    .on('click', function() {
      this.cancel();
    }.bind(this));

  this.$content = this.$container.appendDiv('file-chooser-content');
  this.$title = this.$content.appendDiv('file-chooser-title')
    .text(this.session.text(this.multiSelect ? 'ui.ChooseFiles' : 'ui.ChooseFile'));

  this.fileInput.render(this.$content);

  // DnD and Multiple files are only supported with the new file api
  if (!this.fileInput.legacy) {

    // explanation for file chooser
    this.$content.appendDiv('file-chooser-label')
      .text(this.session.text('ui.FileChooserHint'));

    // List of files
    this.$files = this.$content.appendElement('<ul>', 'file-chooser-files');
    this._installScrollbars();
  }

  // Buttons
  this.$buttons = this.$container.appendDiv('file-chooser-buttons');
  var boxButtons = new scout.BoxButtons(this.$buttons);
  if (!this.fileInput.legacy) {
    this.$addFileButton = boxButtons.addButton({
      text: this.session.text('ui.Browse'),
      onClick: this._onAddFileButtonClicked.bind(this),
      needsClick: true
    });
  }
  this.$uploadButton = boxButtons.addButton({
    text: this.session.text('ui.Upload'),
    onClick: this._onUploadButtonClicked.bind(this),
    enabled: false
  });
  this.$cancelButton = boxButtons.addButton({
    text: this.session.text('Cancel'),
    onClick: this._onCancelButtonClicked.bind(this)
  });

  this.htmlComp = scout.HtmlComponent.install(this.$container, this.session);
  this.htmlComp.setLayout(new scout.FormLayout(this));
  this.htmlComp.pixelBasedSizing = false;

  this.$container.addClassForAnimation('animate-open');
  // Prevent resizing when file chooser is dragged off the viewport
  this.$container.addClass('calc-helper');
  var windowSize = this.$container.windowSize();
  // Use css width, but ensure that it is not larger than the window (mobile)
  var w = Math.min(this.$container.width(), windowSize.width - 20);
  this.$container.css('min-width', w);
  this.$container.css('max-width', w);
  this.$container.removeClass('calc-helper');
  boxButtons.updateButtonWidths(this.$container.width());

  // Render modality glasspanes
  this._glassPaneRenderer.renderGlassPanes();

  // Now that all texts, paddings, widths etc. are set, we can calculate the position
  this._position();
};

scout.FileChooser.prototype._renderProperties = function() {
  scout.FileChooser.parent.prototype._renderProperties.call(this);
  if (this.fileInput.legacy) {
    // Files may not be set into native control -> clear list in order to be sync again
    this.setFiles([]);
  }
  this._renderFiles();
};

scout.FileChooser.prototype._renderEnabled = function() {
  scout.FileChooser.parent.prototype._renderEnabled.call(this);
  this._installOrUninstallDragAndDropHandler();
};

scout.FileChooser.prototype._postRender = function() {
  scout.FileChooser.parent.prototype._postRender.call(this);
  this._installFocusContext();
};

scout.FileChooser.prototype._remove = function() {
  this._glassPaneRenderer.removeGlassPanes();
  this._uninstallFocusContext();
  scout.FileChooser.parent.prototype._remove.call(this);
};

scout.FileChooser.prototype._createDragAndDropHandler = function() {
  return scout.dragAndDrop.handler(this, {
    supportedScoutTypes: scout.dragAndDrop.SCOUT_TYPES.FILE_TRANSFER,
    validateFiles: function(event) {
    },
    onDrop: function(event) {
      this.addFiles(event.files);
    }.bind(this),
    dropType: function() {
      return scout.dragAndDrop.SCOUT_TYPES.FILE_TRANSFER;
    },
    dropMaximumSize: function() {
      return this.maximumUploadSize;
    }.bind(this)
  });
};

scout.FileChooser.prototype._installOrUninstallDragAndDropHandler = function() {
  if (this.enabledComputed) {
    this._installDragAndDropHandler();
  } else {
    this._uninstallDragAndDropHandler();
  }
};

scout.FileChooser.prototype._installDragAndDropHandler = function() {
  if (this.dragAndDropHandler) {
    return;
  }
  this.dragAndDropHandler = this._createDragAndDropHandler();
  if (!this.dragAndDropHandler) {
    return;
  }
  this.dragAndDropHandler.install(this.$container);
};

scout.FileChooser.prototype._uninstallDragAndDropHandler = function() {
  if (!this.dragAndDropHandler) {
    return;
  }
  this.dragAndDropHandler.uninstall();
  this.dragAndDropHandler = null;
};

scout.FileChooser.prototype._installFocusContext = function() {
  this.session.focusManager.installFocusContext(this.$container, scout.focusRule.AUTO);
};

scout.FileChooser.prototype._uninstallFocusContext = function() {
  this.session.focusManager.uninstallFocusContext(this.$container);
};

/**
 * @override
 */
scout.FileChooser.prototype.get$Scrollable = function() {
  return this.$files;
};

scout.FileChooser.prototype._position = function() {
  this.$container.cssMarginLeft(-this.$container.outerWidth() / 2);
};

scout.FileChooser.prototype.setDisplayParent = function(displayParent) {
  this.setProperty('displayParent', displayParent);
};

scout.FileChooser.prototype._setDisplayParent = function(displayParent) {
  this._setProperty('displayParent', displayParent);
  if (displayParent) {
    this.setParent(this.findDesktop().computeParentForDisplayParent(displayParent));
  }
};

scout.FileChooser.prototype.setMaximumUploadSize = function(maximumUploadSize) {
  this.setProperty('maximumUploadSize', maximumUploadSize);
  this.fileInput.setMaximumUploadSize(maximumUploadSize);
};

/**
 * Renders the file chooser and links it with the display parent.
 */
scout.FileChooser.prototype.open = function() {
  this.setDisplayParent(this.displayParent || this.session.desktop);
  this.displayParent.fileChooserController.registerAndRender(this);
};

/**
 * Destroys the file chooser and unlinks it from the display parent.
 */
scout.FileChooser.prototype.close = function() {
  if (!this.rendered) {
    this.cancel();
    return;
  }
  if (this.$cancelButton && this.session.focusManager.requestFocus(this.$cancelButton)) {
    this.$cancelButton.click();
  }
};

scout.FileChooser.prototype.cancel = function() {
  var event = new scout.Event();
  this.trigger('cancel', event);
  if (!event.defaultPrevented) {
    this._close();
  }
};

/**
 * Destroys the file chooser and unlinks it from the display parent.
 */
scout.FileChooser.prototype._close = function() {
  if (this.displayParent) {
    this.displayParent.fileChooserController.unregisterAndRemove(this);
  }
  this.destroy();
};

scout.FileChooser.prototype.browse = function() {
  this.fileInput.browse();
};

scout.FileChooser.prototype.setAcceptTypes = function(acceptTypes) {
  this.setProperty('acceptTypes', acceptTypes);
  this.fileInput.setAcceptTypes(acceptTypes);
};

scout.FileChooser.prototype.setMultiSelect = function(multiSelect) {
  this.setProperty('multiSelect', multiSelect);
  this.fileInput.setMultiSelect(multiSelect);
};

scout.FileChooser.prototype.addFiles = function(files) {
  if (files instanceof FileList) {
    files = scout.FileInput.fileListToArray(files);
  }
  files = scout.arrays.ensure(files);
  if (files.length === 0) {
    return;
  }
  if (!this.multiSelect || this.fileInput.legacy) {
    files = [files[0]];
    this.setFiles([files[0]]);
  } else {
    // copy so that parameter stays untouched
    files = files.slice();
    // append new files to existing ones
    scout.arrays.insertAll(files, this.files, 0);
    this.setFiles(files);
  }
};

scout.FileChooser.prototype.removeFile = function(file) {
  var files = this.files.slice();
  scout.arrays.remove(files, file);
  this.setFiles(files);
  // Clear the input, otherwise user could not choose the file which he has removed previously
  this.fileInput.clear();
};

scout.FileChooser.prototype.setFiles = function(files) {
  if (files instanceof FileList) {
    files = scout.FileInput.fileListToArray(files);
  }
  files = scout.arrays.ensure(files);

  try {
    this.fileInput.validateMaximumUploadSize(files);
  } catch (errorMessage) {
    scout.MessageBoxes.createOk(this)
      .withHeader(this.session.text('ui.FileSizeLimitTitle'))
      .withBody(errorMessage)
      .withSeverity(scout.Status.Severity.ERROR)
      .buildAndOpen();
    return;
  }

  this.setProperty('files', files);
};

scout.FileChooser.prototype._renderFiles = function() {
  var files = this.files;

  if (!this.fileInput.legacy) {
    this.$files.empty();
    files.forEach(function(file) {
      var $file = this.$files.appendElement('<li>', 'file', file.name);
      // Append a space to allow the browser to break the line here when it gets too long
      $file.append(' ');
      var $remove = $file
        .appendSpan('remove menu-item')
        .on('click', this.removeFile.bind(this, file));
      var $removeLink = $file.makeElement('<a>', 'remove-link', this.session.text('Remove'));
      $remove.appendTextNode('(');
      $remove.append($removeLink);
      $remove.appendTextNode(')');
    }, this);
    scout.scrollbars.update(this.$files);
  }
  this.$uploadButton.setEnabled(files.length > 0);
};


scout.FileChooser.prototype._onUploadButtonClicked = function(event) {
  this.trigger('upload');
};

scout.FileChooser.prototype._onCancelButtonClicked = function(event) {
  this.cancel();
};

scout.FileChooser.prototype._onAddFileButtonClicked = function(event) {
  this.browse();
};

scout.FileChooser.prototype._onFileChange = function(event) {
  this.addFiles(event.files);
};

scout.FileChooser.prototype._onMouseDown = function(event, option) {
  // If there is a dialog in the parent-hierarchy activate it in order to bring it on top of other dialogs.
  var parent = this.findParent(function(p) {
    return p instanceof scout.Form && p.isDialog();
  });
  if (parent) {
    parent.activate();
  }
};

/**
 * @override Widget.js
 */
scout.FileChooser.prototype._attach = function() {
  this.$parent.append(this.$container);
  scout.FileChooser.parent.prototype._attach.call(this);
};

/**
 * @override Widget.js
 */
scout.FileChooser.prototype._detach = function() {
  this.$container.detach();
  scout.FileChooser.parent.prototype._detach.call(this);
};
