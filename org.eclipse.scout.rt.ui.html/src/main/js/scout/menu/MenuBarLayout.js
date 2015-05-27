scout.MenuBarLayout = function(menuBar) {
  scout.MenuBarLayout.parent.call(this);
  this._menuBar = menuBar;
  this._ellipsis;
};
scout.inherits(scout.MenuBarLayout, scout.AbstractLayout);

/**
 * @override AbstractLayout.js
 */
scout.MenuBarLayout.prototype.layout = function($container) {
  // check if all menu items have enough room to be displayed without ellipsis
  this._destroyEllipsis();
  this._menuBar.updateItems(this._menuBar.menuItems, true);

  var ellipsisSize, leftEnd = 0, rightEnd, overflown,
    oldOverflow = $container.css('overflow');

  // we cannot set overflow in MenuBar.css because overflow:hidden would cut off the
  // focus border on the left-most button in the menu-bar. That's why we must reset
  // the overflow-property after we've checked if the menu-bar is over-sized.
  $container.css('overflow', 'hidden');
  rightEnd = $container[0].clientWidth;

  // 1st find the left-most position of all right-aligned items
  // see: special comment for negative margins in Menu.css
  this._menuBar.menuItems.forEach(function(menuItem) {
    var tmpX, itemBounds = scout.graphics.bounds(menuItem.$container, true, true);
    if (isRightAligned(menuItem)) {
      tmpX = itemBounds.x;
      if (tmpX < rightEnd) {
        rightEnd = tmpX;
      }
    } else {
      tmpX = itemBounds.x + itemBounds.width;
      if (tmpX > leftEnd) {
        leftEnd = tmpX;
      }
    }
  });

  // 1 instead of 0 is used to tolerate rounding issues, browsers return a rounded width instead of the precise one
  overflown = leftEnd - rightEnd >= 1;
  $container.css('overflow', oldOverflow);

  if (overflown) {
    var menuItemsCopy = [];

    // create ellipsis menu
    this._createAndRenderEllipsis($container);
    ellipsisSize = scout.graphics.getSize(this._ellipsis.$container, true);
    rightEnd -= ellipsisSize.width;

    // right-aligned menus are never put into the overflow ellipsis-menu
    // or in other words: they're not responsive.
    // for left-aligned menus: once we notice a menu-item that does not
    // fit into the available space, all following items must also be
    // put into the overflow ellipsis-menu. Otherwise you would put
    // an item with a long text into the ellipsis-menu, but the next
    // icon, with a short text would still be in the menu-bar. Which would
    // be confusing, as it would look like we've changed the order of the
    // menu-items.
    var overflowNextItems = false;
    this._menuBar.menuItems.forEach(function(menuItem) {
      if (isRightAligned(menuItem)) {
        // Always add right-aligned menus
        menuItemsCopy.push(menuItem);
      } else {
        var itemBounds = scout.graphics.bounds(menuItem.$container, true, true),
          rightOuterX = itemBounds.x + itemBounds.width;
        if (overflowNextItems || rightOuterX > rightEnd) {
          menuItem.remove();
          menuItem.overflow = true;
          this._ellipsis.childActions.push(menuItem);
          overflowNextItems = true;
        } else {
          // Only add left-aligned menu items when they're visible
          menuItem.overflow = false;
          menuItemsCopy.push(menuItem);
        }
      }
    }, this);

    this._addEllipsisToMenuItems(menuItemsCopy);
    this._menuBar.visibleMenuItems = menuItemsCopy;
  } else {
    this._menuBar.visibleMenuItems = this._menuBar.menuItems;
  }

  function isRightAligned(menuItem) {
    return menuItem.$container.hasClass('right-aligned');
  }
};

/**
 * Add the ellipsis menu to the menu-items list. Order matters because we do not sort
 * menu-items again.
 */
scout.MenuBarLayout.prototype._addEllipsisToMenuItems = function(menuItemsCopy) {
  var i, menuItem, insertItemAt = 0;
  for (i = 0; i < menuItemsCopy.length; i++) {
    menuItem = menuItemsCopy[i];
    if (isRightAligned(menuItem)) {
      break;
    } else {
      insertItemAt = i + 1;
    }
  }

  scout.arrays.insert(menuItemsCopy, this._ellipsis, insertItemAt);

  function isRightAligned(menuItem) {
    return menuItem.$container.hasClass('right-aligned');
  }
};

scout.MenuBarLayout.prototype._createAndRenderEllipsis = function($container) {
  var ellipsis = this._menuBar.session.createUiObject({
    objectType: 'Menu',
    horizontalAlignment: 1,
    iconId: 'font:\uF143',
    tabbable: false
  });
  ellipsis.render($container);
  this._ellipsis = ellipsis;
};

scout.MenuBarLayout.prototype._destroyEllipsis = function() {
  if (this._ellipsis) {
    this._ellipsis.destroy();
    this._ellipsis = null;
  }
};

/**
 * @override AbstractLayout.js
 */
scout.MenuBarLayout.prototype.preferredLayoutSize = function($container) {
  var prefSize,
    oldWidth = $container.css('width'),
    oldHeight = $container.css('height'),
    containerMargins = scout.graphics.getMargins($container);

  // reset height and width, so default CSS styles will apply before we measure pref. size
  $container.css('height', '');
  $container.css('width', '');
  prefSize = scout.graphics.getSize($container)
    .subtract(containerMargins);
  $container.css('width', oldWidth);
  $container.css('height', oldHeight);

  return prefSize;
};

