/*
 * Copyright (c) 2018 BSI Business Systems Integration AG.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     BSI Business Systems Integration AG - initial API and implementation
 */
package org.eclipse.scout.rt.client.ui.popup;

import org.eclipse.scout.rt.client.ui.IWidget;

/**
 * Root interface for a popup.
 *
 * @since 9.0
 */
public interface IPopup extends IWidget {

  String PROP_ANCHOR = "anchor";
  String PROP_ANIMATE_OPENING = "animateOpening";
  String PROP_ANIMATE_RESIZE = "animateResize";
  String PROP_WITH_GLASS_PANE = "withGlassPane";
  String PROP_SCROLL_TYPE = "scrollType";
  String PROP_HORIZONTAL_ALIGNMENT = "horizontalAlignment";
  String PROP_VERTICAL_ALIGNMENT = "verticalAlignment";
  String PROP_WITH_ARROW = "withArrow";

  String PROP_TRIM_WIDTH = "trimWidth";
  String PROP_TRIM_HEIGHT = "trimHeight";

  String PROP_HORIZONTAL_SWITCH = "horizontalSwitch";
  String PROP_VERTICAL_SWITCH = "verticalSwitch";

  String PROP_CLOSE_ON_ANCHOR_MOUSE_DOWN = "closeOnAnchorMouseDown";
  String PROP_CLOSE_ON_MOUSE_DOWN_OUTSIDE = "closeOnMouseDownOutside";
  String PROP_CLOSE_ON_OTHER_POPUP_OPEN = "closeOnOtherPopupOpen";

  String SCROLL_TYPE_POSITION = "position";
  String SCROLL_TYPE_LAYOUT_AND_POSITION = "layoutAndPosition";
  String SCROLL_TYPE_REMOVE = "remove";

  String POPUP_ALIGNMENT_LEFT = "left";
  String POPUP_ALIGNMENT_LEFTEDGE = "leftedge";
  String POPUP_ALIGNMENT_TOP = "top";
  String POPUP_ALIGNMENT_TOPEDGE = "topedge";
  String POPUP_ALIGNMENT_CENTER = "center";
  String POPUP_ALIGNMENT_RIGHT = "right";
  String POPUP_ALIGNMENT_RIGHTEDGE = "rightedge";
  String POPUP_ALIGNMENT_BOTTOM = "bottom";
  String POPUP_ALIGNMENT_BOTTOMEDGE = "bottomedge";

  void setAnchor(IWidget anchor);

  IWidget getAnchor();

  void setAnimateOpening(boolean animateOpening);

  boolean isAnimateOpening();

  void setAnimateResize(boolean nnimateResize);

  boolean isAnimateResize();

  /**
   * Note: setting this property while the popup is open has no effect.
   */
  void setWithGlassPane(boolean withGlassPane);

  boolean isWithGlassPane();

  /**
   * Note: setting this property while the popup is open has no effect.
   */
  void setScrollType(String scrollType);

  String getScrollType();

  void setTrimWidth(boolean trimWidth);

  boolean isTrimWidth();

  void setTrimHeight(boolean trimHeight);

  boolean isTrimHeight();

  void setHorizontalAlignment(String horizontalAlignment);

  String getHorizontalAlignment();

  void setVerticalAlignment(String verticalAlignment);

  String getVerticalAlignment();

  void setWithArrow(boolean withArrow);

  boolean isWithArrow();

  void setHorizontalSwitch(boolean horizontalSwitch);

  boolean isHorizontalSwitch();

  void setVerticalSwitch(boolean verticalSwitch);

  boolean isVerticalSwitch();

  /**
   * Note: setting this property while the popup is open has no effect.
   */
  void setCloseOnAnchorMouseDown(boolean closeOnAnchorMouseDown);

  boolean isCloseOnAnchorMouseDown();

  /**
   * Note: setting this property while the popup is open has no effect.
   */
  void setCloseOnMouseDownOutside(boolean closeOnMouseDownOutside);

  boolean isCloseOnMouseDownOutside();

  /**
   * Note: setting this property while the popup is open has no effect.
   */
  void setCloseOnOtherPopupOpen(boolean closeOnOtherPopupOpen);

  boolean isCloseOnOtherPopupOpen();

  void open();

  void close();

  IPopupUIFacade getUIFacade();

}
