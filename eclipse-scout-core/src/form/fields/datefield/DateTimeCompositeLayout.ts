/*
 * Copyright (c) 2010, 2023 BSI Business Systems Integration AG
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
import {AbstractLayout, DateField, Dimension, EventHandler, graphics, HtmlComponent, HtmlCompPrefSizeOptions, HtmlEnvironment, Insets, PropertyChangeEvent} from '../../../index';

export class DateTimeCompositeLayout extends AbstractLayout {
  MIN_DATE_FIELD_WIDTH: number;
  PREF_DATE_FIELD_WIDTH: number;
  MIN_TIME_FIELD_WIDTH: number;
  PREF_TIME_FIELD_WIDTH: number;
  htmlPropertyChangeHandler: EventHandler<PropertyChangeEvent<any, HtmlEnvironment>>;
  hgap: number;
  protected _dateField: DateField;

  constructor(dateField: DateField) {
    super();
    this._dateField = dateField;

    // Minimum field with to normal state, for smaller widths the "compact" style is applied.
    this.MIN_DATE_FIELD_WIDTH = 90;
    this.PREF_DATE_FIELD_WIDTH = 110;
    this.MIN_TIME_FIELD_WIDTH = 60;
    this.PREF_TIME_FIELD_WIDTH = 90;

    this._initDefaults();

    this.htmlPropertyChangeHandler = this._onHtmlEnvironmentPropertyChange.bind(this);
    HtmlEnvironment.get().on('propertyChange', this.htmlPropertyChangeHandler);
    this._dateField.one('remove', () => HtmlEnvironment.get().off('propertyChange', this.htmlPropertyChangeHandler));
  }

  protected _initDefaults() {
    this.hgap = HtmlEnvironment.get().smallColumnGap;
  }

  protected _onHtmlEnvironmentPropertyChange() {
    this._initDefaults();
    this._dateField.invalidateLayoutTree();
  }

  override layout($container: JQuery) {
    let htmlContainer = HtmlComponent.get($container),
      $dateField = this._dateField.$dateField,
      $timeField = this._dateField.$timeField,
      $dateFieldIcon = this._dateField.$dateFieldIcon,
      $timeFieldIcon = this._dateField.$timeFieldIcon,
      $dateClearIcon = this._dateField.$dateClearIcon,
      $timeClearIcon = this._dateField.$timeClearIcon,
      $predictDateField = this._dateField._$predictDateField,
      $predictTimeField = this._dateField._$predictTimeField,
      htmlDateField = ($dateField ? HtmlComponent.get($dateField) : null),
      htmlTimeField = ($timeField ? HtmlComponent.get($timeField) : null),
      hasDate = ($dateField ? !$dateField.isDisplayNone() : false),
      hasTime = ($timeField ? !$timeField.isDisplayNone() : false);

    let availableSize = htmlContainer.availableSize({
      exact: true
    }).subtract(htmlContainer.insets());

    let dateFieldSize: Dimension, timeFieldSize: Dimension;
    // --- Date and time ---
    if (hasDate && hasTime) {
      // Field size
      let dateFieldMargins = htmlDateField.margins();
      let timeFieldMargins = htmlTimeField.margins();
      let compositeMargins = new Insets(
        Math.max(dateFieldMargins.top, timeFieldMargins.top),
        Math.max(dateFieldMargins.right, timeFieldMargins.right),
        Math.max(dateFieldMargins.bottom, timeFieldMargins.bottom),
        Math.max(dateFieldMargins.left, timeFieldMargins.left)
      );
      let compositeSize = availableSize.subtract(compositeMargins);
      let hgap = this._hgap();
      let totalWidth = compositeSize.width - hgap;
      // Date field 60%, time field 40%
      let dateFieldWidth = (totalWidth * 0.6);
      let timeFieldWidth = (totalWidth - dateFieldWidth);

      dateFieldSize = new Dimension(dateFieldWidth, compositeSize.height);
      timeFieldSize = new Dimension(timeFieldWidth, compositeSize.height);
      htmlDateField.setSize(dateFieldSize);
      htmlTimeField.setSize(timeFieldSize);
      $timeField.cssRight(0);

      // Icons
      $dateFieldIcon.cssTop($dateField.cssBorderTopWidth())
        .cssRight(timeFieldWidth + hgap)
        .cssHeight(dateFieldSize.height - $dateField.cssBorderWidthY());
      if ($dateClearIcon) {
        $dateClearIcon.cssTop($dateField.cssBorderTopWidth())
          .cssRight(timeFieldWidth + hgap + $dateField.cssBorderRightWidth())
          .cssHeight(dateFieldSize.height - $dateField.cssBorderWidthY());
      }
      $timeFieldIcon.cssTop($timeField.cssBorderTopWidth())
        .cssRight(0)
        .cssHeight(timeFieldSize.height - $timeField.cssBorderWidthY());
      if ($timeClearIcon) {
        $timeClearIcon.cssTop($timeField.cssBorderTopWidth())
          .cssRight($timeField.cssBorderRightWidth())
          .cssHeight(timeFieldSize.height - $timeField.cssBorderWidthY());
      }

      // Compact style
      $dateField.toggleClass('compact', dateFieldSize.width < this.MIN_DATE_FIELD_WIDTH);
      $timeField.toggleClass('compact', timeFieldSize.width < this.MIN_TIME_FIELD_WIDTH);
      this._dateField.$container.toggleClass('compact-date', dateFieldSize.width < this.MIN_DATE_FIELD_WIDTH);
      this._dateField.$container.toggleClass('compact-time', timeFieldSize.width < this.MIN_TIME_FIELD_WIDTH);

      // Prediction
      if ($predictDateField) {
        graphics.setSize($predictDateField, dateFieldSize);
      }
      if ($predictTimeField) {
        graphics.setSize($predictTimeField, timeFieldSize);
        $predictTimeField.cssRight(0);
      }
    } else if (hasDate) { // --- Date only ---
      // Field size
      dateFieldSize = availableSize.subtract(htmlDateField.margins());
      htmlDateField.setSize(dateFieldSize);

      // Icons
      $dateFieldIcon.cssTop($dateField.cssBorderTopWidth())
        .cssRight(0)
        .cssHeight(dateFieldSize.height - $dateField.cssBorderWidthY());

      if ($dateClearIcon) {
        $dateClearIcon.cssTop($dateField.cssBorderTopWidth())
          .cssRight($dateField.cssBorderRightWidth())
          .cssHeight(dateFieldSize.height - $dateField.cssBorderWidthY());
      }
      // Compact style
      $dateField.toggleClass('compact', dateFieldSize.width < this.MIN_DATE_FIELD_WIDTH);
      this._dateField.$container.toggleClass('compact-date', dateFieldSize.width < this.MIN_DATE_FIELD_WIDTH);

      // Prediction
      if ($predictDateField) {
        graphics.setSize($predictDateField, dateFieldSize);
      }
    } else if (hasTime) { // --- Time only ---
      // Field size
      timeFieldSize = availableSize.subtract(htmlTimeField.margins());
      htmlTimeField.setSize(timeFieldSize);

      // Icons
      $timeFieldIcon.cssTop($timeField.cssBorderTopWidth())
        .cssRight(0)
        .cssHeight(timeFieldSize.height - $timeField.cssBorderWidthY());
      if ($timeClearIcon) {
        $timeClearIcon.cssTop($timeField.cssBorderTopWidth())
          .cssRight($timeField.cssBorderRightWidth())
          .cssHeight(timeFieldSize.height - $timeField.cssBorderWidthY());
      }
      // Compact style
      $timeField.toggleClass('compact', timeFieldSize.width < this.MIN_TIME_FIELD_WIDTH);
      this._dateField.$container.toggleClass('compact-time', timeFieldSize.width < this.MIN_TIME_FIELD_WIDTH);

      // Prediction
      if ($predictTimeField) {
        graphics.setSize($predictTimeField, timeFieldSize);
      }
    }
    let popup = this._dateField.popup;
    if (popup && popup.rendered) {
      // Make sure the popup is correctly positioned (especially necessary for cell editor)
      popup.position();
    }
  }

  protected _hgap(): number {
    return this.hgap;
  }

  override preferredLayoutSize($container: JQuery, options?: HtmlCompPrefSizeOptions): Dimension {
    let prefSize = new Dimension(),
      $dateField = this._dateField.$dateField,
      $timeField = this._dateField.$timeField,
      hasDate = ($dateField ? !$dateField.isDisplayNone() : false),
      hasTime = ($timeField ? !$timeField.isDisplayNone() : false);

    // --- Date and time ---
    if (hasDate && hasTime) {
      prefSize = graphics.prefSize(this._dateField.$dateField);
      prefSize.width = this.PREF_DATE_FIELD_WIDTH + this._hgap() + this.PREF_TIME_FIELD_WIDTH;
    } else if (hasDate) {
      // --- Date only ---
      prefSize = graphics.prefSize(this._dateField.$dateField);
      prefSize.width = this.PREF_DATE_FIELD_WIDTH;
    } else if (hasTime) {
      // --- Time only ---
      prefSize = graphics.prefSize(this._dateField.$timeField);
      prefSize.width = this.PREF_TIME_FIELD_WIDTH;
    }
    return prefSize;
  }
}
