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
/**
 * @class
 * @constructor
 */
scout.Tree = function() {
  scout.Tree.parent.call(this);

  this.toggleBreadcrumbStyleEnabled = false;
  this.autoCheckChildren = false;
  this.checkable = false;
  this.checkableStyle = scout.Tree.CheckableStyle.CHECKBOX_TREE_NODE;
  this.displayStyle = scout.Tree.DisplayStyle.DEFAULT;
  this.dropType = 0;
  this.dropMaximumSize = scout.dragAndDrop.DEFAULT_DROP_MAXIMUM_SIZE;
  this.enabled = true;
  this.filterEnabled = false;
  this.lazyExpandingEnabled = true;
  this.menus = [];
  this.contextMenu = null;
  this.menuBar = null;
  this.keyStrokes = [];
  this.multiCheck = true;
  this.nodes = []; // top-level nodes
  this.nodesMap = {}; // all nodes by id
  this.nodePaddingLevelCheckable = 23; /* padding for one tree-level if the tree is checkable */
  this.nodePaddingLevelNotCheckable = 18; /* padding for one tree-level if the tree is not checkable. this includes outline trees! */
  this.nodePaddingLeft = null; /* is read from CSS */
  this.nodeCheckBoxPaddingLeft = 29;
  this.nodeControlPaddingLeft = null; /* is read from CSS */
  this.nodePaddingLevel = this.nodePaddingLevelNotCheckable;
  this.scrollToSelection = false;
  this.scrollTop = 0;
  this.scrollTopHistory = []; // Only necessary for breadcrumb mode
  this.selectedNodes = [];
  this.prevSelectedNode = null; // The previously selected node, relevant for breadcrumb in compact mode

  // performance optimization: E.g. rather than iterating over the whole tree when unchecking all nodes,
  // we explicitly keep track of nodes to uncheck (useful e.g. for single-check mode in very large trees).
  this.checkedNodes = [];

  this.groupedNodes = {};
  this.visibleNodesFlat = [];
  this.visibleNodesMap = {};
  this._addWidgetProperties(['menus', 'keyStrokes']);
  this._additionalContainerClasses = ''; // may be used by subclasses to set additional CSS classes
  this._filters = [];
  this._doubleClickSupport = new scout.DoubleClickSupport();
  this._$animationWrapper = null; // used by _renderExpansion()
  this._$expandAnimationWrappers = [];
  this._filterMenusHandler = this._filterMenus.bind(this);
  this._popupOpenHandler = this._onDesktopPopupOpen.bind(this);

  // contains all parents of a selected node, the selected node and the first level children
  this._inSelectionPathList = {};
  this.viewRangeRendered = new scout.Range(0, 0);
  this.viewRangeSize = 20;

  this.startAnimationFunc = function() {
    this.runningAnimations++;
  }.bind(this);
  this.runningAnimations = 0;
  this.runningAnimationsFinishFunc = function() {
    this.runningAnimations--;
    if (this.runningAnimations <= 0) {
      this.runningAnimations = 0;
      this._renderViewportBlocked = false;
      this.invalidateLayoutTree();
    }
  }.bind(this);

  this.nodeHeight = 0;
  this.nodeWidth = 0;
  this.maxNodeWidth = 0;
  this.nodeWidthDirty = false;
  this.$data = null;
  this._scrolldirections = 'both';
  this.requestFocusOnNodeControlMouseDown = true;
};
scout.inherits(scout.Tree, scout.Widget);

scout.Tree.DisplayStyle = {
  DEFAULT: 'default',
  BREADCRUMB: 'breadcrumb'
};

scout.Tree.CheckableStyle = {
  /**
   * Node check is only possible by checking the checkbox.
   */
  CHECKBOX: 'checkbox',

  /**
   * Node check is possible by clicking anywhere on the node.
   */
  CHECKBOX_TREE_NODE: 'checkbox_tree_node'
};

/**
 * Used to calculate the view range size. See: #calculateViewRangeSize
 */
scout.Tree.VIEW_RANGE_DIVISOR = 4;

scout.Tree.prototype._init = function(model) {
  scout.Tree.parent.prototype._init.call(this, model);
  this.addFilter(new scout.LazyNodeFilter(this), true);
  this.breadcrumbFilter = new scout.TreeBreadcrumbFilter(this);
  if (this.displayStyle === scout.Tree.DisplayStyle.BREADCRUMB) {
    this.addFilter(this.breadcrumbFilter, true, true);
  }
  this.initialTraversing = true;
  this._setCheckable(this.checkable);
  this._ensureTreeNodes(this.nodes);
  this.visitNodes(this._initTreeNode.bind(this));
  this.visitNodes(this._updateFlatListAndSelectionPath.bind(this));
  this.initialTraversing = false;
  this.selectedNodes = this._nodesByIds(this.selectedNodes);
  this.menuBar = scout.create('MenuBar', {
    parent: this,
    menuOrder: new scout.MenuItemsOrder(this.session, 'Tree'),
    menuFilter: this._filterMenusHandler
  });
  this.menuBar.bottom();
  this._updateItemPath(true);
  this._setDisplayStyle(this.displayStyle);
  this._setKeyStrokes(this.keyStrokes);
  this._setMenus(this.menus);
};

/**
 * Iterates through the given array and converts node-models to instances of scout.TreeNode (or a subclass).
 * If the array element is already a TreeNode the function leaves the element untouched. This function also
 * ensures that the attribute childNodeIndex is set. By default we use the order of the nodes array as index
 * but only if childNodeIndex is undefined.
 *
 * @param nodes Array of node-models (plain object) or nodes (instance of scout.TreeNode)
 */
scout.Tree.prototype._ensureTreeNodes = function(nodes) {
  var i, node;
  for (i = 0; i < nodes.length; i++) {
    node = nodes[i];
    node.childNodeIndex = scout.nvl(node.childNodeIndex, i);
    if (node instanceof scout.TreeNode) {
      continue;
    }
    nodes[i] = this._createTreeNode(node);
  }
};

scout.Tree.prototype._createTreeNode = function(nodeModel) {
  nodeModel = scout.nvl(nodeModel, {});
  nodeModel.parent = this;
  return scout.create('TreeNode', nodeModel);
};

/**
 * @override
 */
scout.Tree.prototype._createKeyStrokeContext = function() {
  return new scout.KeyStrokeContext();
};

/**
 * @override
 */
scout.Tree.prototype._initKeyStrokeContext = function() {
  scout.Tree.parent.prototype._initKeyStrokeContext.call(this);

  this._initTreeKeyStrokeContext();
};

scout.Tree.prototype._initTreeKeyStrokeContext = function() {
  var modifierBitMask = scout.keyStrokeModifier.NONE;

  this.keyStrokeContext.registerKeyStroke([
    new scout.TreeSpaceKeyStroke(this),
    new scout.TreeNavigationUpKeyStroke(this, modifierBitMask),
    new scout.TreeNavigationDownKeyStroke(this, modifierBitMask),
    new scout.TreeCollapseAllKeyStroke(this, modifierBitMask),
    new scout.TreeCollapseOrDrillUpKeyStroke(this, modifierBitMask),
    new scout.TreeNavigationEndKeyStroke(this, modifierBitMask),
    new scout.TreeExpandOrDrillDownKeyStroke(this, modifierBitMask)
  ]);

  // Prevent default action and do not propagate ↓ or ↑ keys if ctrl- or alt-modifier is not pressed.
  // Otherwise, an '↑-event' on the first node, or an '↓-event' on the last row will bubble up (because not consumed by tree navigation keystrokes) and cause a superior tree to move its selection;
  // Use case: - outline tree with a detail form that contains a tree;
  //           - preventDefault because of smartfield, so that the cursor is not moved on first or last row;
  this.keyStrokeContext.registerStopPropagationInterceptor(function(event) {
    if (!event.ctrlKey && !event.altKey && scout.isOneOf(event.which, scout.keys.UP, scout.keys.DOWN)) {
      event.stopPropagation();
      event.preventDefault();
    }
  });
};

scout.Tree.prototype._setMenus = function(menus) {
  this.updateKeyStrokes(menus, this.menus);
  this._setProperty('menus', menus);
  this._updateMenuBar();
};

scout.Tree.prototype._updateMenuBar = function() {
  var menuItems = this._filterMenus(this.menus, scout.MenuDestinations.MENU_BAR, false, true);
  this.menuBar.setMenuItems(menuItems);
  var contextMenuItems = this._filterMenus(this.menus, scout.MenuDestinations.CONTEXT_MENU, true);
  if (this.contextMenu) {
    this.contextMenu.updateMenuItems(contextMenuItems);
  }
};

scout.Tree.prototype._setKeyStrokes = function(keyStrokes) {
  this.updateKeyStrokes(keyStrokes, this.keyStrokes);
  this._setProperty('keyStrokes', keyStrokes);
};

scout.Tree.prototype._resetTreeNode = function(node, parentNode) {
  node.reset();
};

scout.Tree.prototype.isSelectedNode = function(node) {
  if (this.initialTraversing) {
    return this.selectedNodes.indexOf(node.id) > -1;
  } else {
    return this.selectedNodes.indexOf(node) > -1;
  }
};

scout.Tree.prototype._updateFlatListAndSelectionPath = function(node, parentNode) {
  // if this node is selected all parent nodes have to be added to selectionPath
  if (this.isSelectedNode(node) && ((node.parentNode && !this.visibleNodesMap[node.parentNode.id]) || node.level === 0)) {
    var p = node;
    while (p) {
      this._inSelectionPathList[p.id] = true;
      p.filterDirty = true;

      if (p !== node) {
        // ensure node is expanded
        node.expanded = true;
        // if parent was filtered before, try refilter after adding to selection path.
        if (p.level === 0) {
          this._applyFiltersForNode(p);

          // add visible nodes to visible nodes array when they are initialized
          this._addToVisibleFlatList(p, false);

          // process children
          this._addChildrenToFlatList(p, this.visibleNodesFlat.length - 1, false, null, true);
        }
      }
      p = p.parentNode;
    }
  } else if (node.parentNode && this.isSelectedNode(node.parentNode)) {
    this._inSelectionPathList[node.id] = true;
  }

  this._applyFiltersForNode(node);

  // add visible nodes to visible nodes array when they are initialized
  this._addToVisibleFlatList(node, false);
};

scout.Tree.prototype._initTreeNode = function(node, parentNode) {
  this.nodesMap[node.id] = node;
  if (parentNode) {
    node.parentNode = parentNode;
    node.level = node.parentNode.level + 1;
  }
  if (node.checked) {
    this.checkedNodes.push(node);
  }
  this._initTreeNodeInternal(node, parentNode);
  this._updateMarkChildrenChecked(node, true, node.checked);
  node.initialized = true;
};

scout.Tree.prototype._applyNodeDefaultValues = function(node) {
  scout.defaultValues.applyTo(node, 'TreeNode');
};

/**
 * Override this function if you want a custom node init before filtering.
 * The default impl. applies default values to the given node.
 */
scout.Tree.prototype._initTreeNodeInternal = function(node, parentNode) {
  this._applyNodeDefaultValues(node);
};

scout.Tree.prototype._destroy = function() {
  scout.Tree.parent.prototype._destroy.call(this);
  this.visitNodes(this._destroyTreeNode.bind(this));
  this.nodes = []; // finally, clear array with root tree-nodes
};

scout.Tree.prototype._destroyTreeNode = function(node) {
  delete this.nodesMap[node.id];
  this._removeFromFlatList(node, false); // ensure node is not longer in visible nodes list.
  node.destroy();

  if (this._onNodeDeleted) { // Necessary for subclasses
    this._onNodeDeleted(node);
  }
};

/**
 * pre-order (top-down) traversal of the tree-nodes of this tree.<br>
 * if func returns true the children of the visited node are not visited.
 */
scout.Tree.prototype.visitNodes = function(func, parentNode) {
  return scout.Tree.visitNodes(func, this.nodes, parentNode);
};

scout.Tree.prototype._render = function() {
  this.$container = this.$parent.appendDiv('tree');
  if (this._additionalContainerClasses) {
    this.$container.addClass(this._additionalContainerClasses);
  }

  var layout = new scout.TreeLayout(this);
  this.htmlComp = scout.HtmlComponent.install(this.$container, this.session);
  this.htmlComp.setLayout(layout);
  this.htmlComp.pixelBasedSizing = false;

  this.$data = this.$container.appendDiv('tree-data')
    .on('contextmenu', this._onContextMenu.bind(this))
    .on('mousedown', '.tree-node', this._onNodeMouseDown.bind(this))
    .on('mouseup', '.tree-node', this._onNodeMouseUp.bind(this))
    .on('dblclick', '.tree-node', this._onNodeDoubleClick.bind(this))
    .on('mousedown', '.tree-node-control', this._onNodeControlMouseDown.bind(this))
    .on('mouseup', '.tree-node-control', this._onNodeControlMouseUp.bind(this))
    .on('dblclick', '.tree-node-control', this._onNodeControlDoubleClick.bind(this));
  scout.HtmlComponent.install(this.$data, this.session);

  if (this.isHorizontalScrollingEnabled()) {
    this.$data.toggleClass('scrollable-tree', true);
  }

  this._installScrollbars({
    axis: this._scrolldirections
  });
  this._installNodeTooltipSupport();
  this.menuBar.render();
  this._updateNodeDimensions();
  // render display style before viewport (not in renderProperties) to have a correct style from the beginning
  this._renderDisplayStyle();
  this._renderViewport();
  this.session.desktop.on('popupOpen', this._popupOpenHandler);
  this._renderCheckableStyle();
};

scout.Tree.prototype._postRender = function() {
  scout.Tree.parent.prototype._postRender.call(this);
  this._renderSelection();
};

scout.Tree.prototype._remove = function() {
  // remove listener
  this.session.desktop.off('popupOpen', this._popupOpenHandler);

  // stop all animations
  if (this._$animationWrapper) {
    this._$animationWrapper.stop(false, true);
  }
  // Detach nodes from jQuery objects (because those will be removed)
  this.visitNodes(this._resetTreeNode.bind(this));

  this._uninstallDragAndDropHandler();
  this._uninstallNodeTooltipSupport();
  this.$fillBefore = null;
  this.$fillAfter = null;
  this.$data = null;
  // reset rendered view range because now range is rendered
  this.viewRangeRendered = new scout.Range(0, 0);
  scout.Tree.parent.prototype._remove.call(this);
};

scout.Tree.prototype.isHorizontalScrollingEnabled = function() {
  return this._scrolldirections === 'both' || this._scrolldirections === 'x';
};

scout.Tree.prototype.isTreeNodeCheckEnabled = function() {
  return this.checkableStyle === scout.Tree.CheckableStyle.CHECKBOX_TREE_NODE;
};

/**
 * @override
 */
scout.Tree.prototype._onScroll = function() {
  var scrollToSelectionBackup = this.scrollToSelection;
  this.scrollToSelection = false;
  var scrollTop = this.$data[0].scrollTop;
  var scrollLeft = this.$data[0].scrollLeft;
  if (this.scrollTop !== scrollTop) {
    this._renderViewport();
  }
  this.scrollTop = scrollTop;
  this.scrollLeft = scrollLeft;
  this.scrollToSelection = scrollToSelectionBackup;
};

/**
 * @override
 */
scout.Tree.prototype.setScrollTop = function(scrollTop) {
  this.setProperty('scrollTop', scrollTop);
  // call _renderViewport to make sure nodes are rendered immediately. The browser fires the scroll event handled by onDataScroll delayed
  if (this.rendered) {
    this._renderViewport();
    // Render scroll top again to make sure the data really is at the expected position
    // This seems only to be necessary for Chrome and the tree, it seems to work for IE and table.
    // It is not optimal, because actually it should be possible to modify the $data[0].scrollTop without using this function
    // Some debugging showed that after reducing the height of the afterFiller in _renderFiller the scrollTop will be wrong.
    // Updating the scrollTop in renderFiller or other view range relevant function is bad because it corrupts smooth scrolling (see also commit c14ce92e0a7bff568d4f2d715e3061a782e728c2)
    this._renderScrollTop();
  }
};

/**
 * @override
 */
scout.Tree.prototype._renderScrollTop = function() {
  if (this.rendering) {
    // Not necessary to do it while rendering since it will be done by the layout
    return;
  }
  scout.scrollbars.scrollTop(this.$data, this.scrollTop);
};

/**
 * @override
 */
scout.Tree.prototype.get$Scrollable = function() {
  return this.$data;
};

scout.Tree.prototype._renderViewport = function() {
  if (this.runningAnimations > 0 || this._renderViewportBlocked) {
    // animation pending do not render view port because finishing should rerenderViewport
    return;
  }
  if (!this.$container.isEveryParentVisible()) {
    // If the tree is invisible, the width and height of the nodes cannot be determined
    // In that case, the tree won't be layouted either -> as soon as it will be layouted, renderViewport will be called again
    return;
  }
  var viewRange = this._calculateCurrentViewRange();
  this._renderViewRange(viewRange);
};

scout.Tree.prototype._calculateCurrentViewRange = function() {
  var node,
    scrollTop = this.$data[0].scrollTop,
    maxScrollTop = this.$data[0].scrollHeight - this.$data[0].clientHeight;

  if (maxScrollTop === 0 && this.visibleNodesFlat.length > 0) {
    // no scrollbars visible
    node = this.visibleNodesFlat[0];
  } else {
    node = this._nodeAtScrollTop(scrollTop);
  }

  return this._calculateViewRangeForNode(node);
};

scout.Tree.prototype._rerenderViewport = function() {
  if (this._renderViewportBlocked) {
    return;
  }
  this._removeRenderedNodes();
  this._renderFiller();
  this._updateDomNodeWidth();
  this._updateDomNodeIconWidth();
  this._renderViewport();
};

scout.Tree.prototype._removeRenderedNodes = function() {
  var $nodes = this.$data.find('.tree-node');
  $nodes.each(function(i, elem) {
    var $node = $(elem),
      node = $node.data('node');
    if ($node.hasClass('hiding')) {
      // Do not remove nodes which are removed using an animation
      return;
    }
    this._removeNode(node);
  }.bind(this));
  this.viewRangeRendered = new scout.Range(0, 0);
};

scout.Tree.prototype._renderViewRangeForNode = function(node) {
  var viewRange = this._calculateViewRangeForNode(node);
  this._renderViewRange(viewRange);
};

scout.Tree.prototype._renderNodesInRange = function(range) {
  var prepend = false;

  var nodes = this.visibleNodesFlat;
  if (nodes.length === 0) {
    return;
  }

  var maxRange = new scout.Range(0, nodes.length);
  range = maxRange.intersect(range);
  if (this.viewRangeRendered.size() > 0 && !range.intersect(this.viewRangeRendered).equals(new scout.Range(0, 0))) {
    throw new Error('New range must not intersect with existing.');
  }
  if (range.to <= this.viewRangeRendered.from) {
    prepend = true;
  }
  var newRange = this.viewRangeRendered.union(range);
  if (newRange.length === 2) {
    throw new Error('Can only prepend or append rows to the existing range. Existing: ' + this.viewRangeRendered + '. New: ' + newRange);
  }
  this.viewRangeRendered = newRange[0];

  var numNodesRendered = this.ensureRangeVisible(range);

  $.log.isTraceEnabled() && $.log.trace(numNodesRendered + ' new nodes rendered from ' + range);
};

scout.Tree.prototype.ensureRangeVisible = function(range) {
  var nodes = this.visibleNodesFlat;
  var nodesToInsert = [];
  for (var r = range.from; r < range.to; r++) {
    var node = nodes[r];
    if (!node.attached) {
      nodesToInsert.push(node);
    }
  }
  this._insertNodesInDOM(nodesToInsert);
  return nodesToInsert.length;
};

scout.Tree.prototype._renderFiller = function() {
  if (!this.$fillBefore) {
    this.$fillBefore = this.$data.prependDiv('tree-data-fill');
  }

  var fillBeforeDimensions = this._calculateFillerDimension(new scout.Range(0, this.viewRangeRendered.from));
  this.$fillBefore.cssHeight(fillBeforeDimensions.height);
  if (this.isHorizontalScrollingEnabled()) {
    this.$fillBefore.cssWidth(fillBeforeDimensions.width);
    this.maxNodeWidth = Math.max(fillBeforeDimensions.width, this.maxNodeWidth);
  }
  $.log.isTraceEnabled() && $.log.trace('FillBefore height: ' + fillBeforeDimensions.height);

  if (!this.$fillAfter) {
    this.$fillAfter = this.$data.appendDiv('tree-data-fill');
  }

  var fillAfterDimensions = {
    height: 0,
    width: 0
  };
  fillAfterDimensions = this._calculateFillerDimension(new scout.Range(this.viewRangeRendered.to, this.visibleNodesFlat.length));
  this.$fillAfter.cssHeight(fillAfterDimensions.height);
  if (this.isHorizontalScrollingEnabled()) {
    this.$fillAfter.cssWidth(fillAfterDimensions.width);
    this.maxNodeWidth = Math.max(fillAfterDimensions.width, this.maxNodeWidth);
  }
  $.log.isTraceEnabled() && $.log.trace('FillAfter height: ' + fillAfterDimensions.height);
};

scout.Tree.prototype._calculateFillerDimension = function(range) {
  var outerWidth = 0;
  if (this.rendered) {
    // the outer-width is only correct if this tree is already rendered. otherwise wrong values are returned.
    outerWidth = this.$data.outerWidth();
  }
  var dimension = {
    height: 0,
    width: Math.max(outerWidth, this.maxNodeWidth)
  };
  for (var i = range.from; i < range.to; i++) {
    var node = this.visibleNodesFlat[i];
    dimension.height += this._heightForNode(node);
    dimension.width = Math.max(dimension.width, this._widthForNode(node));
  }
  return dimension;
};

scout.Tree.prototype._removeNodesInRange = function(range) {
  var fromNode, toNode, node, i,
    numNodesRemoved = 0,
    nodes = this.visibleNodesFlat;

  var maxRange = new scout.Range(0, nodes.length);
  range = maxRange.intersect(range);
  fromNode = nodes[range.from];
  toNode = nodes[range.to];

  var newRange = this.viewRangeRendered.subtract(range);
  if (newRange.length === 2) {
    throw new Error('Can only remove nodes at the beginning or end of the existing range. ' + this.viewRangeRendered + '. New: ' + newRange);
  }
  this.viewRangeRendered = newRange[0];

  for (i = range.from; i < range.to; i++) {
    node = nodes[i];
    this._removeNode(node);
    numNodesRemoved++;
  }

  $.log.isTraceEnabled() && $.log.trace(numNodesRemoved + ' nodes removed from ' + range + '.');
};

/**
 * Just removes the node, does NOT adjust this.viewRangeRendered
 */
scout.Tree.prototype._removeNode = function(node) {
  var $node = node.$node;
  if (!$node) {
    return;
  }
  if ($node.hasClass('hiding')) {
    // Do not remove nodes which are removed using an animation
    return;
  }
  //only remove node
  $node.detach();
  node.attached = false;
};

/**
 * Renders the rows visible in the viewport and removes the other rows
 */
scout.Tree.prototype._renderViewRange = function(viewRange) {
  if (viewRange.from === this.viewRangeRendered.from && viewRange.to === this.viewRangeRendered.to && !this.viewRangeDirty) {

    // When node with has changed (because of changes in layout) we must at least
    // update the internal node width even though the view-range has not changed.
    if (this.nodeWidthDirty) {
      this._renderFiller();
      this._updateDomNodeWidth();
      this._updateDomNodeIconWidth();
    }

    // Range already rendered -> do nothing
    return;
  }
  if (!this.viewRangeDirty) {
    var rangesToRender = viewRange.subtract(this.viewRangeRendered);
    var rangesToRemove = this.viewRangeRendered.subtract(viewRange);
    var maxRange = new scout.Range(0, this.visibleNodesFlat.length);

    rangesToRemove.forEach(function(range) {
      this._removeNodesInRange(range);
      if (maxRange.to < range.to) {
        this.viewRangeRendered = viewRange;
      }
    }.bind(this));
    rangesToRender.forEach(function(range) {
      this._renderNodesInRange(range);
    }.bind(this));
  } else {
    //expansion changed
    this.viewRangeRendered = viewRange;
    this.ensureRangeVisible(viewRange);
  }

  // check if at least last and first row in range got correctly rendered
  if (this.viewRangeRendered.size() > 0) {
    var nodes = this.visibleNodesFlat;
    var firstNode = nodes[this.viewRangeRendered.from];
    var lastNode = nodes[this.viewRangeRendered.to - 1];
    if (this.viewRangeDirty) {
      // cleanup nodes before range and after
      var $nodesBeforFirstNode = firstNode.$node.prevAll('.tree-node');
      var $nodesAfterLastNode = lastNode.$node.nextAll('.tree-node');
      this._cleanupNodes($nodesBeforFirstNode);
      this._cleanupNodes($nodesAfterLastNode);
    }
    if (!firstNode.attached || !lastNode.attached) {
      throw new Error('Nodes not rendered as expected. ' + this.viewRangeRendered + '. First: ' + firstNode.$node + '. Last: ' + lastNode.$node);
    }
  }

  this._postRenderViewRange();
  this.viewRangeDirty = false;
};

scout.Tree.prototype._postRenderViewRange = function() {
  this._renderFiller();
  this._updateDomNodeWidth();
  this._updateDomNodeIconWidth();
  this._renderSelection();
};

/**
 * The handling of the icon-size here depends on two assumptions:
 *
 * 1. font icons are always pre-loaded on application startup. This means outerWidth() will always return the correct
 *    size of the icon at any time.
 *
 * 2. bitmap icons are not pre-loaded. This means, when the icon is shown, the size can be unknown because the
 *    browser has not yet loaded the image resource. Because of that outerWidth() could not return the correct size
 *    and also layout would have trouble. Because in a tree all icons should have the same size, we simply define
 *    the min-width and min-height of bitmap icons by CSS. So we always have a proper value when we read the icon
 *    size. We don't support the case where the same tree has bitmap icons in different sizes. When someone needs
 *    larger icons, one could simple change the global constant @tree-node-bitmap-icon-size to change the icon size
 *    for all trees, or set a CSS rule/class when only a single tree must have a different icon size.
 */
scout.Tree.prototype._updateDomNodeIconWidth = function($nodes) {
  if (!this.rendered && !this.rendering) {
    return;
  }
  this._visibleNodesInViewRange().forEach(function(node) {
    node._updateIconWidth();
  });
};

scout.Tree.prototype._visibleNodesInViewRange = function() {
  return this.visibleNodesFlat.slice(this.viewRangeRendered.from, this.viewRangeRendered.to);
};

scout.Tree.prototype._updateDomNodeWidth = function() {
  if (!this.isHorizontalScrollingEnabled()) {
    return;
  }
  if (!this.rendered || !this.nodeWidthDirty) {
    return;
  }
  var nodes = this._visibleNodesInViewRange();
  var maxNodeWidth = this.maxNodeWidth;
  // find max-width
  maxNodeWidth = nodes.reduce(function(aggr, node) {
    return Math.max(node.width, aggr);
  }, scout.nvl(maxNodeWidth, 0));
  // set max width on all nodes
  nodes.forEach(function(node) {
    node.$node.cssWidth(maxNodeWidth);
  });
  this.nodeWidthDirty = false;
};

scout.Tree.prototype._cleanupNodes = function($nodes) {
  for (var i = 0; i < $nodes.length; i++) {
    this._removeNode($nodes.eq(i).data('node'));
  }
};

/**
 * Returns the index of the node which is at position scrollTop.
 */
scout.Tree.prototype._nodeAtScrollTop = function(scrollTop) {
  var height = 0,
    nodeTop;
  this.visibleNodesFlat.some(function(node, i) {
    height += this._heightForNode(node);
    if (scrollTop < height) {
      nodeTop = node;
      return true;
    }
  }.bind(this));
  var visibleNodesLength = this.visibleNodesFlat.length;
  if (!nodeTop && visibleNodesLength > 0) {
    nodeTop = this.visibleNodesFlat[visibleNodesLength - 1];
  }
  return nodeTop;
};

scout.Tree.prototype._heightForNode = function(node) {
  var height = 0;
  if (node.height) {
    height = node.height;
  } else {
    height = this.nodeHeight;
  }
  return height;
};

scout.Tree.prototype._widthForNode = function(node) {
  var width = 0;
  if (node.width) {
    width = node.width;
  } else {
    width = this.nodeWidth;
  }
  return width;
};

/**
 * Returns a range of size this.viewRangeSize. Start of range is nodeIndex - viewRangeSize / 4.
 * -> 1/4 of the nodes are before the viewport 2/4 in the viewport 1/4 after the viewport,
 * assuming viewRangeSize is 2*number of possible nodes in the viewport (see calculateViewRangeSize).
 */
scout.Tree.prototype._calculateViewRangeForNode = function(node) {
  var viewRange = new scout.Range(),
    quarterRange = Math.floor(this.viewRangeSize / scout.Tree.VIEW_RANGE_DIVISOR),
    diff;

  var nodeIndex = this.visibleNodesFlat.indexOf(node);
  viewRange.from = Math.max(nodeIndex - quarterRange, 0);
  viewRange.to = Math.min(viewRange.from + this.viewRangeSize, this.visibleNodesFlat.length);
  if (!node || nodeIndex === -1) {
    return viewRange;
  }

  // Try to use the whole viewRangeSize (extend from if necessary)
  diff = this.viewRangeSize - viewRange.size();
  if (diff > 0) {
    viewRange.from = Math.max(viewRange.to - this.viewRangeSize, 0);
  }
  return viewRange;
};

/**
 * Calculates the optimal view range size (number of nodes to be rendered).
 * It uses the default node height to estimate how many nodes fit in the view port.
 * The view range size is this value * 2.
 * <p>
 * Note: the value calculated by this function is important for calculating the
 * 'insertBatch'. When the value becomes smaller than 4 (VIEW_RANGE_DIVISOR) this
 * will cause errors on inserting nodes at the right position. See #262890.
 */
scout.Tree.prototype.calculateViewRangeSize = function() {
  // Make sure row height is up to date (row height may be different after zooming)
  this._updateNodeDimensions();

  if (this.nodeHeight === 0) {
    throw new Error('Cannot calculate view range with nodeHeight = 0');
  }

  var viewRangeMultiplier = scout.Tree.VIEW_RANGE_DIVISOR / 2; // See: #_calculateViewRangeForNode()
  var viewRange = Math.ceil(this.$data.outerHeight() / this.nodeHeight) * viewRangeMultiplier;
  return Math.max(scout.Tree.VIEW_RANGE_DIVISOR, viewRange);
};

scout.Tree.prototype.setViewRangeSize = function(viewRangeSize) {
  if (this.viewRangeSize === viewRangeSize) {
    return;
  }
  this._setProperty('viewRangeSize', viewRangeSize);
  if (this.rendered) {
    this._renderViewport();
  }
};

scout.Tree.prototype._updateNodeDimensions = function() {
  var emptyNode = this._createTreeNode();
  var $node = this._renderNode(emptyNode).appendTo(this.$data);
  this.nodeHeight = $node.outerHeight(true);
  if (this.isHorizontalScrollingEnabled()) {
    var oldNodeWidth = this.nodeWidth;
    this.nodeWidth = $node.outerWidth(true);
    if (oldNodeWidth !== this.nodeWidth) {
      this.viewRangeDirty = true;
    }
  }
  emptyNode.reset();
};

/**
 * Updates the node heights for every visible node and clears the height of the others
 */
scout.Tree.prototype.updateNodeHeights = function() {
  this.visibleNodesFlat.forEach(function(node) {
    if (!node.attached) {
      node.height = null;
    } else {
      node.height = node.$node.outerHeight(true);
    }
  });
};

scout.Tree.prototype.removeAllNodes = function() {
  this._removeNodes(this.nodes);
};

/**
 * @param parentNode
 *          Optional. If provided, this node's state will be updated (e.g. it will be collapsed
 *          if it does no longer have child nodes). Can also be an array, in which case all of
 *          those nodes are updated.
 */
scout.Tree.prototype._removeNodes = function(nodes, parentNode) {
  if (nodes.length === 0) {
    return;
  }

  nodes.forEach(function(node) {
    this._removeFromFlatList(node, true);
    if (node.childNodes.length > 0) {
      this._removeNodes(node.childNodes, node);
    }
    if (node.$node) {
      if (this._$animationWrapper && this._$animationWrapper.find(node.$node).length > 0) {
        this._$animationWrapper.stop(false, true);
      }
      node.reset();
    }
  }, this);

  //If every child node was deleted mark node as collapsed (independent of the model state)
  //--> makes it consistent with addNodes and expand (expansion is not allowed if there are no child nodes)
  scout.arrays.ensure(parentNode).forEach(function(p) {
    if (p && p.$node && p.childNodes.length === 0) {
      p.$node.removeClass('expanded lazy');
    }
  });
  if (this.rendered) {
    this.viewRangeDirty = true;
    this.invalidateLayoutTree();
  }
};

scout.Tree.prototype._renderNode = function(node) {
  var paddingLeft = this._computeNodePaddingLeft(node);
  node.render(this.$container, paddingLeft, this.checkable, this.enabled);
  return node.$node;
};

scout.Tree.prototype._removeMenus = function() {
  // menubar takes care about removal
};

scout.Tree.prototype._filterMenus = function(menus, destination, onlyVisible, enableDisableKeyStroke) {
  return scout.menus.filterAccordingToSelection('Tree', this.selectedNodes.length, menus, destination, onlyVisible, enableDisableKeyStroke);
};

/**
 * @override Widget.js
 */
scout.Tree.prototype._renderEnabled = function() {
  scout.Tree.parent.prototype._renderEnabled.call(this);

  this._installOrUninstallDragAndDropHandler();
  var enabled = this.enabled;
  this.$data.setEnabled(enabled);
  this.$container.setTabbable(enabled);

  if (this.rendered) {
    // Enable/disable all checkboxes
    this.$nodes().each(function() {
      var $node = $(this),
        node = $node.data('node');

      $node.children('.tree-node-checkbox')
        .children('.check-box')
        .toggleClass('disabled', !(enabled && node.enabled));
    });
  }
};

/**
 * @override Widget.js
 */
scout.Tree.prototype._renderDisabledStyle = function() {
  scout.Tree.parent.prototype._renderDisabledStyle.call(this);
  this._renderDisabledStyleInternal(this.$data);
};

scout.Tree.prototype.setCheckable = function(checkable) {
  this.setProperty('checkable', checkable);
};

scout.Tree.prototype._setCheckable = function(checkable) {
  this._setProperty('checkable', checkable);
  if (this.checkable) {
    this.nodePaddingLevel = this.nodePaddingLevelCheckable;
  } else {
    this.nodePaddingLevel = this.nodePaddingLevelNotCheckable;
  }
};

scout.Tree.prototype.setCheckableStyle = function(checkableStyle) {
  this.setProperty('checkableStyle', checkableStyle);
};

scout.Tree.prototype._renderCheckable = function() {
  // Define helper functions
  var isNodeRendered = function(node) {
    return !!node.$node;
  };
  var updateCheckableStateRec = function(node) {
    var $node = node.$node;
    var $control = $node.children('.tree-node-control');
    var $checkbox = $node.children('.tree-node-checkbox');

    node._updateControl($control, this);
    if (this.checkable) {
      if ($checkbox.length === 0) {
        node._renderCheckbox();
      }
    } else {
      $checkbox.remove();
    }

    $node.css('padding-left', this._computeNodePaddingLeft(node));

    // Recursion
    if (node.childNodes) {
      node.childNodes.filter(isNodeRendered).forEach(updateCheckableStateRec);
    }
  }.bind(this);

  // Start recursion
  this.nodes.filter(isNodeRendered).forEach(updateCheckableStateRec);
};

scout.Tree.prototype._renderDisplayStyle = function() {
  this.$container.toggleClass('breadcrumb', this.isBreadcrumbStyleActive());
  this._updateNodePaddingsLeft();
  // update scrollbar if mode has changed (from tree to bc or vice versa)
  this.invalidateLayoutTree();
};

scout.Tree.prototype._renderExpansion = function(node, options) {
  var opts = {
    expandLazyChanged: false,
    expansionChanged: false
  };
  $.extend(opts, options);

  var $node = node.$node,
    expanded = node.expanded;

  // Only render if node is rendered to make it possible to expand/collapse currently hidden nodes (used by collapseAll).
  if (!$node || $node.length === 0) {
    return;
  }

  // Only expand / collapse if there are child nodes
  if (node.childNodes.length === 0) {
    return true;
  }

  $node.toggleClass('lazy', expanded && node.expandedLazy);
  if (!opts.expansionChanged && !opts.expandLazyChanged) {
    // Expansion state has not changed -> return
    return;
  }

  if (expanded) {
    $node.addClass('expanded');
  } else {
    $node.removeClass('expanded');
  }
};

scout.Tree.prototype._renderSelection = function() {
  // Add children class to root nodes if no nodes are selected
  if (this.selectedNodes.length === 0) {
    this.nodes.forEach(function(childNode) {
      if (childNode.rendered) {
        childNode.$node.addClass('child-of-selected');
      }
    }, this);
  }

  this.selectedNodes.forEach(function(node) {
    if (!this.visibleNodesMap[node.id]) {
      return;
    }

    // Mark all ancestor nodes, especially necessary for bread crumb mode
    var parentNode = node.parentNode;
    if (parentNode && parentNode.rendered) {
      parentNode.$node.addClass('parent-of-selected');
    }
    while (parentNode) {
      if (parentNode.rendered) {
        parentNode.$node.addClass('ancestor-of-selected');
      }
      parentNode = parentNode.parentNode;
    }

    // Mark all child nodes
    if (node.expanded) {
      node.childNodes.forEach(function(childNode) {
        if (childNode.rendered) {
          childNode.$node.addClass('child-of-selected');
        }
      }, this);
    }

    if (node.rendered) {
      node.$node.select(true);
    }
  }, this);

  // Update 'group' markers for all rendered nodes
  for (var i = this.viewRangeRendered.from; i < this.viewRangeRendered.to; i++) {
    if (i >= this.visibleNodesFlat.length) {
      break;
    }
    var node = this.visibleNodesFlat[i];
    if (node && node.rendered) {
      node.$node.toggleClass('group', !!this.groupedNodes[node.id]);
    }
  }

  this._updateNodePaddingsLeft();
  this._highlightPrevSelectedNode();

  if (this.scrollToSelection) {
    this.revealSelection();
  }
};

scout.Tree.prototype._renderCheckableStyle = function() {
  this.$data.toggleClass('checkable', this.isTreeNodeCheckEnabled());
};

scout.Tree.prototype._highlightPrevSelectedNode = function() {
  if (!this.isBreadcrumbStyleActive()) {
    return;
  }
  if (!this.prevSelectedNode || !this.prevSelectedNode.rendered || this.prevSelectedNode.prevSelectionAnimationDone) {
    return;
  }
  // Highlight previously selected node, but do it only once
  this.prevSelectedNode.$node.addClassForAnimation('animate-prev-selected').oneAnimationEnd(function() {
    this.prevSelectedNode.prevSelectionAnimationDone = true;
  }.bind(this));
};

scout.Tree.prototype._removeSelection = function() {
  // Remove children class on root nodes if no nodes were selected
  if (this.selectedNodes.length === 0) {
    this.nodes.forEach(function(childNode) {
      if (childNode.rendered) {
        childNode.$node.removeClass('child-of-selected');
      }
    }, this);
  }

  // Ensure animate-prev-selected class is removed (in case animation did not start)
  if (this.prevSelectedNode && this.prevSelectedNode.rendered) {
    this.prevSelectedNode.$node.removeClass('animate-prev-selected');
  }

  this.selectedNodes.forEach(this._removeNodeSelection, this);
};

scout.Tree.prototype._removeNodeSelection = function(node) {
  if (node.rendered) {
    node.$node.select(false);
  }

  // remove ancestor and child classes
  var parentNode = node.parentNode;
  if (parentNode && parentNode.rendered) {
    parentNode.$node.removeClass('parent-of-selected');
  }
  while (parentNode && parentNode.rendered) {
    parentNode.$node.removeClass('ancestor-of-selected');
    parentNode = parentNode.parentNode;
  }
  if (node.expanded) {
    node.childNodes.forEach(function(childNode) {
      if (childNode.rendered) {
        childNode.$node.removeClass('child-of-selected');
      }
    }, this);
  }
};

scout.Tree.prototype.setDropType = function(dropType) {
  this.setProperty('dropType', dropType);
};

scout.Tree.prototype._renderDropType = function() {
  this._installOrUninstallDragAndDropHandler();
};

scout.Tree.prototype.setDropMaximumSize = function(dropMaximumSize) {
  this.setProperty('dropMaximumSize', dropMaximumSize);
};

scout.Tree.prototype._createDragAndDropHandler = function() {
  return scout.dragAndDrop.handler(this, {
    supportedScoutTypes: scout.dragAndDrop.SCOUT_TYPES.FILE_TRANSFER,
    onDrop: function(event) {
      this.trigger('drop', event);
    }.bind(this),
    dropType: function() {
      return this.dropType;
    }.bind(this),
    dropMaximumSize: function() {
      return this.dropMaximumSize;
    }.bind(this),
    additionalDropProperties: function(event) {
      var $target = $(event.currentTarget);
      var properties = {
        nodeId: ''
      };
      if ($target.hasClass('tree-node')) {
        var node = $target.data('node');
        properties.nodeId = node.id;
      }
      return properties;
    }
  });
};

scout.Tree.prototype._installOrUninstallDragAndDropHandler = function() {
  if (this.dropType && this.enabledComputed) {
    this._installDragAndDropHandler();
  } else {
    this._uninstallDragAndDropHandler();
  }
};

scout.Tree.prototype._installDragAndDropHandler = function() {
  if (this.dragAndDropHandler) {
    return;
  }
  this.dragAndDropHandler = this._createDragAndDropHandler();
  if (!this.dragAndDropHandler) {
    return;
  }
  this.dragAndDropHandler.install(this.$container, '.tree-data,.tree-node');
};

scout.Tree.prototype._uninstallDragAndDropHandler = function(event) {
  if (!this.dragAndDropHandler) {
    return;
  }
  this.dragAndDropHandler.uninstall();
  this.dragAndDropHandler = null;
};

scout.Tree.prototype._updateMarkChildrenChecked = function(node, init, checked, checkChildrenChecked) {
  if (!this.checkable) {
    return;
  }

  if (checkChildrenChecked) {
    var childrenFound = false;
    for (var j = 0; j < node.childNodes.length > 0; j++) {
      var childNode = node.childNodes[j];
      if (childNode.checked || childNode.childrenChecked) {
        node.childrenChecked = true;
        checked = true;
        childrenFound = true;
        if (this.rendered && node.$node) {
          node.$node
            .children('.tree-node-checkbox')
            .children('.check-box')
            .toggleClass('children-checked', true);
        }
        break;
      }
    }
    if (!childrenFound) {
      node.childrenChecked = false;
      if (this.rendered && node.$node) {
        node.$node.children('.tree-node-checkbox')
          .children('.check-box')
          .toggleClass('children-checked', false);
      }
    }
  }

  if (!node.parentNode || node.parentNode.checked) {
    return;
  }

  var stateChanged = false;
  if (!checked && !init) {
    //node was unchecked check siblings
    var hasCheckedSiblings = false;
    for (var i = 0; i < node.parentNode.childNodes.length > 0; i++) {
      var siblingNode = node.parentNode.childNodes[i];
      if (siblingNode.checked || siblingNode.childrenChecked) {
        hasCheckedSiblings = true;
        break;
      }
    }
    if (hasCheckedSiblings !== node.parentNode.childrenChecked) {
      //parentNode.checked should be false
      node.parentNode.childrenChecked = hasCheckedSiblings;
      stateChanged = true;
    }
  }
  if ((checked && !node.parentNode.childrenChecked)) {
    node.parentNode.childrenChecked = true;
    stateChanged = true;
  }
  if (stateChanged) {
    this._updateMarkChildrenChecked(node.parentNode, init, checked);
    if (this.rendered && node.parentNode.$node) {
      if (checked) {
        node.parentNode.$node.children('.tree-node-checkbox')
          .children('.check-box')
          .toggleClass('children-checked', true);
      } else {
        node.parentNode.$node.children('.tree-node-checkbox')
          .children('.check-box')
          .toggleClass('children-checked', false);
      }
    }
  }
};

scout.Tree.prototype._installNodeTooltipSupport = function() {
  scout.tooltips.install(this.$data, {
    parent: this,
    selector: '.tree-node',
    text: this._nodeTooltipText.bind(this),
    arrowPosition: 50,
    arrowPositionUnit: '%',
    nativeTooltip: !scout.device.isCustomEllipsisTooltipPossible()
  });
};

scout.Tree.prototype._uninstallNodeTooltipSupport = function() {
  scout.tooltips.uninstall(this.$data);
};

scout.Tree.prototype._nodeTooltipText = function($node) {
  var node = $node.data('node');
  if (node.tooltipText) {
    return node.tooltipText;
  } else if (this._isTruncatedNodeTooltipEnabled() && $node.isContentTruncated()) {
    return node.$text.text();
  }
};

scout.Tree.prototype._isTruncatedNodeTooltipEnabled = function() {
  return true;
};

scout.Tree.prototype.setDisplayStyle = function(displayStyle) {
  if (this.displayStyle === displayStyle) {
    return;
  }
  this._renderViewportBlocked = true;
  this._setDisplayStyle(displayStyle);
  if (this.rendered) {
    this._renderDisplayStyle();
  }
  this._renderViewportBlocked = false;
};

scout.Tree.prototype._setDisplayStyle = function(displayStyle) {
  this._setProperty('displayStyle', displayStyle);

  if (this.displayStyle === scout.Tree.DisplayStyle.BREADCRUMB) {
    if (this.selectedNodes.length > 0) {
      var selectedNode = this.selectedNodes[0];
      if (!selectedNode.expanded) {
        this.expandNode(selectedNode);
      }
    }
    this.addFilter(this.breadcrumbFilter, true, true);
    this.filterVisibleNodes();
  } else {
    this.removeFilter(this.breadcrumbFilter, true);
    this.filter();
  }
};

scout.Tree.prototype._updateNodePaddingsLeft = function() {
  this.$nodes().each(function(index, element) {
    var $node = $(element),
      node = $node.data('node'),
      paddingLeft = this._computeNodePaddingLeft(node);
    $node.css('padding-left', scout.objects.isNullOrUndefined(paddingLeft) ? '' : paddingLeft);
  }.bind(this));
};

scout.Tree.prototype.setBreadcrumbStyleActive = function(active) {
  if (active) {
    this.setDisplayStyle(scout.Tree.DisplayStyle.BREADCRUMB);
  } else {
    this.setDisplayStyle(scout.Tree.DisplayStyle.DEFAULT);
  }
};

scout.Tree.prototype.isNodeInBreadcrumbVisible = function(node) {
  return this._inSelectionPathList[node.id] === undefined ? false : this._inSelectionPathList[node.id];
};

scout.Tree.prototype.isBreadcrumbStyleActive = function() {
  return this.displayStyle === scout.Tree.DisplayStyle.BREADCRUMB;
};

scout.Tree.prototype.setToggleBreadcrumbStyleEnabled = function(enabled) {
  this.setProperty('toggleBreadcrumbStyleEnabled', enabled);
};

scout.Tree.prototype.setBreadcrumbTogglingThreshold = function(width) {
  this.setProperty('breadcrumbTogglingThreshold', width);
};

scout.Tree.prototype.expandNode = function(node, opts) {
  this.setNodeExpanded(node, true, opts);
};

scout.Tree.prototype.collapseNode = function(node, opts) {
  this.setNodeExpanded(node, false, opts);
};

scout.Tree.prototype.collapseAll = function() {
  this.rebuildSuppressed = true;
  // Collapse all expanded child nodes (only model)
  this.visitNodes(function(node) {
    this.collapseNode(node);
  }.bind(this));

  if (this.rendered) {
    // ensure correct rendering
    this._rerenderViewport();
  }

  this.rebuildSuppressed = false;
};

scout.Tree.prototype.setNodeExpanded = function(node, expanded, opts) {
  opts = opts || {};
  var lazy = opts.lazy;
  if (scout.objects.isNullOrUndefined(lazy)) {
    if (node.expanded === expanded) {
      // no state change: Keep the current "expandedLazy" state
      lazy = node.expandedLazy;
    } else if (expanded) {
      // collapsed -> expanded: Set the "expandedLazy" state to the node's "lazyExpandingEnabled" flag
      lazy = node.lazyExpandingEnabled;
    } else {
      // expanded -> collapsed: Set the "expandedLazy" state to false
      lazy = false;
    }
  }
  var renderAnimated = scout.nvl(opts.renderAnimated, true);

  // Never do lazy expansion if it is disabled on the tree
  if (!this.lazyExpandingEnabled) {
    lazy = false;
  }

  if (this.isBreadcrumbStyleActive()) {
    // Do not allow to collapse a selected node
    if (!expanded && this.selectedNodes.indexOf(node) > -1) {
      this.setNodeExpanded(node, true, opts);
      return;
    }
  }

  // Optionally collapse all children (recursively)
  if (opts.collapseChildNodes) {
    // Suppress render expansion
    var childOpts = scout.objects.valueCopy(opts);
    childOpts.renderExpansion = false;

    node.childNodes.forEach(function(childNode) {
      if (childNode.expanded) {
        this.collapseNode(childNode, childOpts);
      }
    }.bind(this));
  }
  var renderExpansionOpts = {
    expansionChanged: false,
    expandLazyChanged: false
  };

  // Set expansion state
  if (node.expanded !== expanded || node.expandedLazy !== lazy) {
    renderExpansionOpts.expansionChanged = node.expanded !== expanded;
    renderExpansionOpts.expandLazyChanged = node.expandedLazy !== lazy;
    node.expanded = expanded;
    node.expandedLazy = lazy;

    var filterStateChanged = this._applyFiltersForNode(node);
    if (filterStateChanged && renderExpansionOpts.expansionChanged) {
      if (node.parentNode) {
        // ensure node is visible under the parent node if there is a parent.
        this._rebuildParent(node.parentNode, opts);
      } else {
        if (node.filterAccepted) {
          this._addToVisibleFlatList(node, false);
        } else {
          this._removeFromFlatList(node, false);
        }
      }
    } else if (renderExpansionOpts.expandLazyChanged) {
      node.childNodes.forEach(function(child) {
        this._applyFiltersForNode(child);
      }.bind(this));
    }

    if (this.groupedNodes[node.id]) {
      this._updateItemPath(false, node);
    }

    if (node.expanded) {
      node.ensureLoadChildren().done(
        this._addChildrenToFlatList.bind(this, node, null, renderAnimated, null, true));
    } else {
      this._removeChildrenFromFlatList(node, renderAnimated);
    }
    this.trigger('nodeExpanded', {
      node: node,
      expanded: expanded,
      expandedLazy: lazy
    });
    this.viewRangeDirty = true;
  }

  // Render expansion
  if (this.rendered && scout.nvl(opts.renderExpansion, true)) {
    this._renderExpansion(node, renderExpansionOpts);
  }

  if (this.rendered) {
    this.ensureExpansionVisible(node);
  }
};

scout.Tree.prototype.setNodeExpandedRecursive = function(nodes, expanded, opts) {
  scout.Tree.visitNodes(function(childNode) {
    this.setNodeExpanded(childNode, expanded, opts);
  }.bind(this), nodes);
};

scout.Tree.prototype._rebuildParent = function(node, opts) {
  if (this.rebuildSuppressed) {
    return;
  }
  if (node.expanded || node.expandedLazy) {
    this._addChildrenToFlatList(node, null, false, null, true);
  } else {
    this._removeChildrenFromFlatList(node, false);
  }
  // Render expansion
  if (this.rendered && scout.nvl(opts.renderExpansion, true)) {
    var renderExpansionOpts = {
      expansionChanged: true
    };
    this._renderExpansion(node, renderExpansionOpts);
  }
};

scout.Tree.prototype._removeChildrenFromFlatList = function(parentNode, animatedRemove) {
  // Only if a parent is available the children are available.
  if (this.visibleNodesMap[parentNode.id]) {
    var parentIndex = this.visibleNodesFlat.indexOf(parentNode);
    var elementsToDelete = 0;
    var parentLevel = parentNode.level;
    var removedNodes = [];
    animatedRemove = animatedRemove && this.rendered;
    if (this._$animationWrapper) {
      // Note: Do _not_ use finish() here! Although documentation states that it is "similar" to stop(true, true),
      // this does not seem to be the case. Implementations differ slightly in details. The effect is, that when
      // calling stop() the animation stops and the 'complete' callback is executed immediately. However, when calling
      // finish(), the callback is _not_ executed! (This may or may not be a bug in jQuery, I cannot tell...)
      this._$animationWrapper.stop(false, true);
    }
    this._$expandAnimationWrappers.forEach(function($wrapper) {
      $wrapper.stop(false, true);
    });
    for (var i = parentIndex + 1; i < this.visibleNodesFlat.length; i++) {
      if (this.visibleNodesFlat[i].level > parentLevel) {
        var node = this.visibleNodesFlat[i];
        if (this.isHorizontalScrollingEnabled()) {
          //if node is the node which defines the widest width then recalculate width for render
          if (node.width === this.maxNodeWidth) {
            this.maxNodeWidth = 0;
            this.nodeWidthDirty = true;
          }
        }
        delete this.visibleNodesMap[this.visibleNodesFlat[i].id];
        if (node.attached && animatedRemove) {
          if (!this._$animationWrapper) {
            this._$animationWrapper = $('<div class="animation-wrapper">').insertBefore(node.$node);
            this._$animationWrapper.data('parentNode', parentNode);
          }
          if (node.isChildOf(this._$animationWrapper.data('parentNode'))) {
            this._$animationWrapper.append(node.$node);
          }
          node.attached = false;
          node.displayBackup = node.$node.css('display');
          removedNodes.push(node);
        } else if (node.attached && !animatedRemove) {
          this.hideNode(node, false, false);
        }
        elementsToDelete++;
      } else {
        break;
      }
    }

    this.visibleNodesFlat.splice(parentIndex + 1, elementsToDelete);
    // animate closing
    if (animatedRemove) { // don't animate while rendering (not necessary, or may even lead to timing issues)
      this._renderViewportBlocked = true;
      if (removedNodes.length > 0) {
        this._$animationWrapper.animate({
          height: 0
        }, {
          start: this.startAnimationFunc,
          complete: onAnimationComplete.bind(this, removedNodes),
          step: this.revalidateLayoutTree.bind(this),
          duration: 200,
          queue: false
        });
      } else if (this._$animationWrapper) {
        this._$animationWrapper.remove();
        this._$animationWrapper = null;
        onAnimationComplete.call(this, removedNodes);
      } else {
        this._renderViewportBlocked = false;
      }
    }
    return removedNodes;
  }

  //----- Helper functions -----
  function onAnimationComplete(affectedNodes) {
    affectedNodes.forEach(function(node) {
      node.$node.detach();
      node.$node.css('display', node.displayBackup);
      node.displayBackup = null;
    });
    if (this._$animationWrapper) {
      this._$animationWrapper.remove();
      this._$animationWrapper = null;
    }
    this.runningAnimationsFinishFunc();
  }

};

scout.Tree.prototype._removeFromFlatList = function(node, animatedRemove) {
  var removedNodes = [];
  if (this.visibleNodesMap[node.id]) {
    var index = this.visibleNodesFlat.indexOf(node);
    this._removeChildrenFromFlatList(node, false);
    if (this.isHorizontalScrollingEnabled()) {
      //if node is the node which defines the widest width then recalculate width for render
      if (node.width === this.maxNodeWidth) {
        this.maxNodeWidth = 0;
        this.nodeWidthDirty = true;
      }
    }
    removedNodes = scout.arrays.ensure(this.visibleNodesFlat.splice(index, 1));
    delete this.visibleNodesMap[node.id];
    this.hideNode(node, animatedRemove);
  }
  removedNodes.push(node);
  return removedNodes;
};

/**
 * @returns {boolean} whether or not the function added a node to the flat list
 */
scout.Tree.prototype._addToVisibleFlatList = function(node, renderingAnimated) {
  // if node already is in visible list don't do anything. If no parentNode is available this node is on toplevel, if a parent is available
  // it has to be in visible list and also be expanded
  if (!this.visibleNodesMap[node.id] && node.isFilterAccepted() && (!node.parentNode ||
      (node.parentNode.expanded && this.visibleNodesMap[node.parentNode.id]))) {
    if (this.initialTraversing) {
      // for faster index calculation
      this._addToVisibleFlatListNoCheck(node, this.visibleNodesFlat.length, renderingAnimated);
    } else {
      var insertIndex = this._findInsertPositionInFlatList(node);
      this._addToVisibleFlatListNoCheck(node, insertIndex, renderingAnimated);
    }
  }
};

// TODO [7.0] CGU applies to all the add/remove to/from flat list methods:
// Is it really necessary to update dom on every operation? why not just update the list and renderViewport at the end?
// The update of the flat list is currently implemented quite complicated -> it should be simplified.
// And: because add to flat list renders all the children the rendered node count is greater than the viewRangeSize until
// the layout renders the viewport again -> this must not happen (can be seen when a node gets expanded)
scout.Tree.prototype._addChildrenToFlatList = function(parentNode, parentIndex, animatedRendering, insertBatch, forceFilter) {
  // add nodes recursively
  if (!this.visibleNodesMap[parentNode.id]) {
    return 0;
  }

  var isSubAdding = !!insertBatch;
  parentIndex = parentIndex ? parentIndex : this.visibleNodesFlat.indexOf(parentNode);
  animatedRendering = animatedRendering && this.rendered; // don't animate while rendering (not necessary, or may even lead to timing issues)
  if (this._$animationWrapper && !isSubAdding) {
    // Note: Do _not_ use finish() here! Although documentation states that it is "similar" to stop(true, true),
    // this does not seem to be the case. Implementations differ slightly in details. The effect is, that when
    // calling stop() the animation stops and the 'complete' callback is executed immediately. However, when calling
    // finish(), the callback is _not_ executed! (This may or may not be a bug in jQuery, I cannot tell...)
    this._$animationWrapper.stop(false, true);
  }

  if (insertBatch) {
    insertBatch.setInsertAt(parentIndex);
  } else {
    insertBatch = this.newInsertBatch(parentIndex + 1);
  }

  parentNode.childNodes.forEach(function(node, index) {
    if (!node.initialized || !node.isFilterAccepted(forceFilter)) {
      return;
    }

    var insertIndex, isAlreadyAdded = this.visibleNodesMap[node.id];
    if (isAlreadyAdded) {
      this.insertBatchInVisibleNodes(insertBatch, this._showNodes(insertBatch), animatedRendering);
      this.checkAndHandleBatchAnimationWrapper(parentNode, animatedRendering, insertBatch);
      insertBatch = this.newInsertBatch(insertBatch.nextBatchInsertIndex());
      insertBatch = this._addChildrenToFlatListIfExpanded(1, node, insertIndex, animatedRendering, insertBatch, forceFilter);
      // do not animate following
      animatedRendering = false;
    } else {
      insertBatch.insertNodes.push(node);
      this.visibleNodesMap[node.id] = true;
      insertBatch = this.checkAndHandleBatch(insertBatch, parentNode, animatedRendering);
      insertBatch = this._addChildrenToFlatListIfExpanded(0, node, insertIndex, animatedRendering, insertBatch, forceFilter);
    }
  }.bind(this));

  if (!isSubAdding) {
    // animation is not done yet and all added nodes are in visible range
    this.insertBatchInVisibleNodes(insertBatch, this._showNodes(insertBatch), animatedRendering);
    this.invalidateLayoutTree();
  }

  return insertBatch;
};

/**
 * Checks if the given node is expanded, and if that's the case determine the insert index of the node and add its children to the flat list.
 *
 * @param {number} indexOffset either 0 or 1, offset is added to the insert index
 */
scout.Tree.prototype._addChildrenToFlatListIfExpanded = function(indexOffset, node, insertIndex, animatedRendering, insertBatch, forceFilter) {
  if (node.expanded && node.childNodes.length) {
    if (insertBatch.containsNode(node.parentNode) || insertBatch.length() > 1) {
      // if parent node is already in the batch, do not change the insertIndex,
      // only append child nodes below that parent node
      // Also, if the batch is not empty (i.e. contains more nodes than the current node),
      // the insert index was already calculated previously and must not be changed.
      insertIndex = insertBatch.insertAt();
    } else {
      insertIndex = this._findInsertPositionInFlatList(node);
    }
    insertIndex += indexOffset;
    insertBatch = this._addChildrenToFlatList(node, insertIndex, animatedRendering, insertBatch, forceFilter);
  }

  return insertBatch;
};

scout.Tree.prototype._showNodes = function(insertBatch) {
  return this.viewRangeRendered.from + this.viewRangeSize >= insertBatch.lastBatchInsertIndex() &&
    this.viewRangeRendered.from <= insertBatch.lastBatchInsertIndex();
};

/**
 * This function tries to find the correct insert position within the flat list for the given node.
 * The function must consider the order of child nodes in the original tree structure and then check
 * where in the flat list this position is.
 */
scout.Tree.prototype._findInsertPositionInFlatList = function(node) {
  var childNodes,
    parentNode = node.parentNode;

  // use root nodes as nodes when no other parent node is available (root case)
  if (parentNode) {
    childNodes = parentNode.childNodes;
  } else {
    childNodes = this.nodes;
  }

  // find all visible siblings for our node (incl. our own node, which is probably not yet
  // in the visible nodes map)
  var thatNode = node;
  var siblings = childNodes.filter(function(node) {
    return !!this.visibleNodesMap[node.id] || node === thatNode;
  }.bind(this));

  // when there are no visible siblings, insert below the parent node
  if (siblings.length === 0) {
    return this._findPositionInFlatList(parentNode) + 1;
  }

  var nodePos = siblings.indexOf(node);

  // when there are no prev. siblings in the flat list, insert below the parent node
  if (nodePos === 0) {
    return this._findPositionInFlatList(parentNode) + 1;
  }

  var prevSiblingNode = siblings[nodePos - 1];
  var prevSiblingPos = this._findPositionInFlatList(prevSiblingNode);

  // when the prev. sibling is not in the flat list, insert below the parent node
  if (prevSiblingPos === -1) {
    return this._findPositionInFlatList(parentNode) + 1;
  }

  // find the index of the last child element of our prev. sibling node
  // that's where we want to insert the new node. We go down the flat list
  // starting from the prev. sibling node, until we hit a node that does not
  // belong to the sub tree of the prev. sibling node.
  var i, checkNode;
  for (i = prevSiblingPos; i < this.visibleNodesFlat.length; i++) {
    checkNode = this.visibleNodesFlat[i];
    if (!this._isInSameSubTree(prevSiblingNode, checkNode)) {
      return i;
    }
  }

  // insert at the end of the list
  return this.visibleNodesFlat.length;
};

scout.Tree.prototype._findPositionInFlatList = function(node) {
  return this.visibleNodesFlat.indexOf(node);
};

/**
 * Checks whether the given checkNode belongs to the same sub tree (or is) the given node.
 * The function goes up all parentNodes of the checkNode.
 *
 * @param {scout.TreeNode} node which is used to for the sub tree comparison
 * @param {scout.TreeNode} checkNode node which is checked against the given node
 * @returns {boolean}
 */
scout.Tree.prototype._isInSameSubTree = function(node, checkNode) {
  do {
    if (checkNode === node || checkNode.parentNode === node) {
      return true;
    }
    checkNode = checkNode.parentNode;
  } while (checkNode);

  return false;
};

/**
 * Returns true if the given node is a child of one of the selected nodes.
 * The functions goes up the parent node hierarchy.
 *
 * @param {scout.TreeNode} node to check
 * @returns {boolean}
 */
scout.Tree.prototype._isChildOfSelectedNodes = function(node) {
  while (node) {
    if (this.selectedNodes.indexOf(node.parentNode) > -1) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
};

/**
 * Info: the object created here is a bit weird: the array 'insertNodes' is used as function arguments to the Array#splice function at some point.
 * The signature of that function is: array.splice(index, deleteCount[, element1[,  element2 [, ...]]])
 * So the first two elements are numbers and all the following elements are TreeNodes or Pages.
 */
scout.Tree.prototype.newInsertBatch = function(insertIndex) {
  return {
    insertNodes: [insertIndex, 0], // second element is always 0 (used as argument for deleteCount in Array#splice)
    $animationWrapper: null,
    lastBatchInsertIndex: function() {
      if (this.isEmpty()) {
        return this.insertAt();
      } else {
        return this.insertAt() + this.insertNodes.length - 3;
      }
    },
    nextBatchInsertIndex: function() {
      // only NBU knows what this means
      return this.lastBatchInsertIndex() + (this.isEmpty() ? 1 : 2);
    },
    isEmpty: function() {
      return this.insertNodes.length === 2;
    },
    length: function() {
      return this.insertNodes.length - 2;
    },
    insertAt: function() {
      return this.insertNodes[0];
    },
    setInsertAt: function(insertAt) {
      this.insertNodes[0] = insertAt;
    },
    containsNode: function(node) {
      return this.insertNodes.indexOf(node) !== -1;
    }
  };
};

scout.Tree.prototype.checkAndHandleBatchAnimationWrapper = function(parentNode, animatedRendering, insertBatch) {
  if (animatedRendering && this.viewRangeRendered.from <= insertBatch.lastBatchInsertIndex() && this.viewRangeRendered.to >= insertBatch.lastBatchInsertIndex() && !insertBatch.$animationWrapper) {
    //we are in visible area so we need a animation wrapper
    //if parent is in visible area insert after parent else insert before first node.
    var lastNodeIndex = insertBatch.lastBatchInsertIndex() - 1,
      nodeBefore = this.viewRangeRendered.from === insertBatch.lastBatchInsertIndex() ? null : this.visibleNodesFlat[lastNodeIndex];
    if (nodeBefore && lastNodeIndex >= this.viewRangeRendered.from && lastNodeIndex < this.viewRangeRendered.to && !nodeBefore.attached) {
      //ensure node before is visible
      this.showNode(nodeBefore, false, lastNodeIndex);
    }
    if (nodeBefore && nodeBefore.attached) {
      insertBatch.$animationWrapper = $('<div class="animation-wrapper">').insertAfter(nodeBefore.$node);
    } else if (parentNode.attached) {
      insertBatch.$animationWrapper = $('<div class="animation-wrapper">').insertAfter(parentNode.$node);
    } else if (this.$fillBefore) {
      insertBatch.$animationWrapper = $('<div class="animation-wrapper">').insertAfter(this.$fillBefore);
    } else {
      var nodeAfter = this.visibleNodesFlat[insertBatch.lastBatchInsertIndex()];
      insertBatch.$animationWrapper = $('<div class="animation-wrapper">').insertBefore(nodeAfter.$node);
    }
    insertBatch.animationCompleteFunc = onAnimationComplete;
    this._$expandAnimationWrappers.push(insertBatch.$animationWrapper);
  }
  //----- Helper functions ----- //

  function onAnimationComplete() {
    insertBatch.$animationWrapper.replaceWith(insertBatch.$animationWrapper.contents());
    scout.arrays.remove(this._$expandAnimationWrappers, insertBatch.$animationWrapper);
    insertBatch.$animationWrapper = null;
    this.runningAnimationsFinishFunc();
  }
};

scout.Tree.prototype.checkAndHandleBatch = function(insertBatch, parentNode, animatedRendering) {
  if (this.viewRangeRendered.from - 1 === insertBatch.lastBatchInsertIndex()) {
    //do immediate rendering because list could be longer
    this.insertBatchInVisibleNodes(insertBatch, false, false);
    insertBatch = this.newInsertBatch(insertBatch.lastBatchInsertIndex() + 1);
  }
  this.checkAndHandleBatchAnimationWrapper(parentNode, animatedRendering, insertBatch);

  if (this.viewRangeRendered.from + this.viewRangeSize - 1 === insertBatch.lastBatchInsertIndex()) {
    //do immediate rendering because list could be longer
    this.insertBatchInVisibleNodes(insertBatch, true, animatedRendering);
    insertBatch = this.newInsertBatch(insertBatch.lastBatchInsertIndex() + 1);
  }
  return insertBatch;
};

scout.Tree.prototype.insertBatchInVisibleNodes = function(insertBatch, showNodes, animate) {
  if (insertBatch.isEmpty()) {
    // nothing to add
    return;
  }
  this.visibleNodesFlat.splice.apply(this.visibleNodesFlat, insertBatch.insertNodes);
  if (showNodes) {
    var indexHint = insertBatch.insertAt();
    for (var i = 2; i < insertBatch.insertNodes.length; i++) {
      var node = insertBatch.insertNodes[i];
      this.showNode(node, false, indexHint);
      if (insertBatch.$animationWrapper) {
        insertBatch.$animationWrapper.append(node.$node);
      }
      indexHint++;
    }
    if (insertBatch.$animationWrapper) {
      var h = insertBatch.$animationWrapper.outerHeight();
      insertBatch.$animationWrapper
        .css('height', 0)
        .animate({
          height: h
        }, {
          start: this.startAnimationFunc,
          complete: insertBatch.animationCompleteFunc.bind(this),
          step: this.revalidateLayoutTree.bind(this),
          duration: 200,
          queue: false
        });
    }
  } else if (insertBatch.$animationWrapper && insertBatch.animationCompleteFunc) {
    insertBatch.animationCompleteFunc.call(this);
  }
};

scout.Tree.prototype._addToVisibleFlatListNoCheck = function(node, insertIndex, animatedRendering) {
  scout.arrays.insert(this.visibleNodesFlat, node, insertIndex);
  this.visibleNodesMap[node.id] = true;
  if (this.rendered) {
    this.showNode(node, animatedRendering, insertIndex);
  }
};

scout.Tree.prototype.scrollTo = function(node, options) {
  if (this.viewRangeRendered.size() === 0) {
    // Cannot scroll to a node if no node is rendered
    return;
  }
  if (!node.attached) {
    this._renderViewRangeForNode(node);
  }
  scout.scrollbars.scrollTo(this.$data, node.$node, options);
};

scout.Tree.prototype.revealSelection = function() {
  if (!this.rendered) {
    // Execute delayed because tree may be not layouted yet
    this.session.layoutValidator.schedulePostValidateFunction(this.revealSelection.bind(this));
    return;
  }

  if (this.selectedNodes.length > 0) {
    if (!this.visibleNodesMap[this.selectedNodes[0].id]) {
      this._expandAllParentNodes(this.selectedNodes[0]);
    }
    this.scrollTo(this.selectedNodes[0]);
    this.ensureExpansionVisible(this.selectedNodes[0]);
  }
};

scout.Tree.prototype.ensureExpansionVisible = function(node) {
  // only scroll if treenode is in dom and the current node is selected (user triggered expansion change)
  if (!node || !node.$node || this.selectedNodes[0] !== node) {
    return;
  }
  scout.scrollbars.ensureExpansionVisible({
    element: node,
    $element: node.$node,
    $scrollable: this.get$Scrollable(),
    isExpanded: function(element) {
      return element.expanded;
    },
    getChildren: function(parent) {
      return parent.childNodes;
    },
    nodePaddingLevel: this.nodePaddingLevel,
    defaultChildHeight: this.nodeHeight
  });
};

scout.Tree.prototype.deselectAll = function() {
  this.selectNodes([]);
};

scout.Tree.prototype.selectNode = function(node, debounceSend) {
  this.selectNodes(node, debounceSend);
};

scout.Tree.prototype.selectNodes = function(nodes, debounceSend) {
  nodes = scout.arrays.ensure(nodes);

  // TODO [8.0] CGU Actually, the nodes should be filtered here so that invisible nodes may not be selected
  // But this is currently not possible because the LazyNodeFilter would not accept the nodes
  // We would have to keep track of the clicked nodes and check them in the lazy node filter (e.g. selectedNode.parentNode.lazySelectedChildNodes[selectedNode.id] = selectedNode).
  // But since this requires a change in setNodeExpanded as well we decided to not implement it until the TODO at _addChildrenToFlatList is solved

  if (scout.arrays.equalsIgnoreOrder(nodes, this.selectedNodes)) {
    return;
  }

  if (this.rendered) {
    this._rememberScrollTopBeforeSelection();
    this._removeSelection();
  }
  if (this.prevSelectedNode) {
    this.prevSelectedNode.prevSelectionAnimationDone = false;
  }
  this.prevSelectedNode = this.selectedNodes[0];
  this._setSelectedNodes(nodes, debounceSend);
  if (this.rendered) {
    this._renderSelection();
    this._updateScrollTopAfterSelection();
  }
};

scout.Tree.prototype._rememberScrollTopBeforeSelection = function() {
  if (this.isBreadcrumbStyleActive()) {
    // Save the current scrollTop for future up navigation
    if (this.selectedNodes.length > 0) {
      this.scrollTopHistory[this.selectedNodes[0].level] = this.$data[0].scrollTop;
    }
  } else {
    // Clear history if user now works with tree to not get confused when returning to bc mode
    this.scrollTopHistory = [];
  }
};

scout.Tree.prototype._updateScrollTopAfterSelection = function() {
  if (!this.isBreadcrumbStyleActive()) {
    return;
  }
  var currentLevel = -1;
  if (this.selectedNodes.length > 0) {
    currentLevel = this.selectedNodes[0].level;
  }
  // Remove positions after the current level (no restore when going down, only when going up)
  this.scrollTopHistory.splice(currentLevel + 1);
  // Read the scroll top for the current level and use that one if it is set
  var scrollTopForLevel = this.scrollTopHistory[currentLevel];
  if (scrollTopForLevel >= 0) {
    this.setScrollTop(scrollTopForLevel);
  }
};

scout.Tree.prototype._setSelectedNodes = function(nodes, debounceSend) {
  // Make a copy so that original array stays untouched
  this.selectedNodes = nodes.slice();
  this._nodesSelectedInternal();
  this._triggerNodesSelected(debounceSend);

  if (this.selectedNodes.length > 0 && !this.visibleNodesMap[this.selectedNodes[0].id]) {
    this._expandAllParentNodes(this.selectedNodes[0]);
  }

  this._updateItemPath(true);
  if (this.isBreadcrumbStyleActive()) {
    // In breadcrumb mode selected node has to expanded
    if (this.selectedNodes.length > 0 && !this.selectedNodes[0].expanded) {
      this.expandNode(this.selectedNodes[0]);
      this.selectedNodes[0].filterDirty = true;
    }
    this.filter(true);
  }
  this.session.onRequestsDone(this._updateMenuBar.bind(this));
};

/**
 * This method is overridden by subclasses of Tree. The default impl. does nothing.
 */
scout.Tree.prototype._nodesSelectedInternal = function(node) {
  // NOP
};

scout.Tree.prototype.deselectNode = function(node) {
  this.deselectNodes(node);
};

scout.Tree.prototype.deselectNodes = function(nodes) {
  nodes = scout.arrays.ensure(nodes);
  var selectedNodes = this.selectedNodes.slice(); // copy
  if (scout.arrays.removeAll(selectedNodes, nodes)) {
    this.selectNodes(selectedNodes);
  }
};

scout.Tree.prototype.isNodeSelected = function(node) {
  return this.selectedNodes.indexOf(node) > -1;
};

scout.Tree.prototype._computeNodePaddingLeft = function(node) {
  this._computeNodePaddings();
  if (this.isBreadcrumbStyleActive()) {
    return null;
  }
  var padding = node.level * this.nodePaddingLevel + this.nodePaddingLeft;
  if (this.checkable) {
    padding += this.nodeCheckBoxPaddingLeft;
  }
  return padding;
};

/**
 * Reads the paddings from CSS and stores them in nodePaddingLeft and nodeControlPaddingLeft
 */
scout.Tree.prototype._computeNodePaddings = function() {
  if (this.nodePaddingLeft !== null && this.nodeControlPaddingLeft !== null) {
    return;
  }
  var $dummyNode = this.$data.appendDiv('tree-node');
  var $dummyNodeControl = $dummyNode.appendDiv('tree-node-control');
  if (this.nodePaddingLeft === null) {
    this.nodePaddingLeft = $dummyNode.cssPaddingLeft();
  }
  if (this.nodeControlPaddingLeft === null) {
    this.nodeControlPaddingLeft = $dummyNodeControl.cssPaddingLeft();
  }
  $dummyNode.remove();
};

scout.Tree.prototype._expandAllParentNodes = function(node) {
  var i, currNode = node,
    parentNodes = [];

  currNode = node;
  var nodesToInsert = [];
  while (currNode.parentNode) {
    parentNodes.push(currNode.parentNode);
    if (!this.visibleNodesMap[currNode.id]) {
      nodesToInsert.push(currNode);
    }
    currNode = currNode.parentNode;
  }

  for (i = parentNodes.length - 1; i >= 0; i--) {
    if (nodesToInsert.indexOf(parentNodes[i]) !== -1) {
      this._addToVisibleFlatList(parentNodes[i], false);
    }
    if (!parentNodes[i].expanded) {
      this.expandNode(parentNodes[i], {
        renderExpansion: false,
        renderAnimated: false
      });
    }
  }
  if (this.rendered && nodesToInsert.length > 0) {
    this._rerenderViewport();
    this.invalidateLayoutTree();
  }
};

scout.Tree.prototype._updateChildNodeIndex = function(nodes, startIndex) {
  if (!nodes || !nodes.length) {
    return;
  }
  for (var i = scout.nvl(startIndex, 0); i < nodes.length; i++) {
    nodes[i].childNodeIndex = i;
  }
};

scout.Tree.prototype.insertNode = function(node, parentNode) {
  this.insertNodes([node], parentNode);
};

scout.Tree.prototype.insertNodes = function(nodes, parentNode) {
  nodes = scout.arrays.ensure(nodes).slice();
  this._ensureTreeNodes(nodes);
  if (parentNode && !(parentNode instanceof scout.TreeNode)) {
    throw new Error('parent has to be a tree node: ' + parentNode);
  }

  // Append continuous node blocks
  nodes.sort(function(a, b) {
    return a.childNodeIndex - b.childNodeIndex;
  });

  // Update parent with new child nodes
  if (parentNode) {
    if (parentNode.childNodes && parentNode.childNodes.length > 0) {
      nodes.forEach(function(entry) {
        // only insert node if not already existing
        if (parentNode.childNodes.indexOf(entry) < 0) {
          scout.arrays.insert(parentNode.childNodes, entry, entry.childNodeIndex);
        }
      }.bind(this));
      this._updateChildNodeIndex(parentNode.childNodes, nodes[0].childNodeIndex);
    } else {
      nodes.forEach(function(entry) {
        parentNode.childNodes.push(entry);
      }.bind(this));
    }
    //initialize node and add to visible list if node is visible
    scout.Tree.visitNodes(this._initTreeNode.bind(this), nodes, parentNode);
    scout.Tree.visitNodes(this._updateFlatListAndSelectionPath.bind(this), nodes, parentNode);
    if (this.groupedNodes[parentNode.id]) {
      this._updateItemPath(false, parentNode);
    }
    if (this.rendered) {
      var opts = {
        expansionChanged: true
      };
      this._renderExpansion(parentNode, opts);
      this.ensureExpansionVisible(parentNode);
    }
  } else {
    if (this.nodes && this.nodes.length > 0) {
      nodes.forEach(function(entry) {
        // only insert node if not already existing
        if (this.nodes.indexOf(entry) < 0) {
          scout.arrays.insert(this.nodes, entry, entry.childNodeIndex);
        }
      }.bind(this));
      this._updateChildNodeIndex(this.nodes, nodes[0].childNodeIndex);
    } else {
      scout.arrays.pushAll(this.nodes, nodes);
    }
    //initialize node and add to visible list if node is visible
    scout.Tree.visitNodes(this._initTreeNode.bind(this), nodes, parentNode);
    scout.Tree.visitNodes(this._updateFlatListAndSelectionPath.bind(this), nodes, parentNode);
  }
  if (this.rendered) {
    this.viewRangeDirty = true;
    this.invalidateLayoutTree();
  }
  this.trigger('nodesInserted', {
    nodes: nodes,
    parentNode: parentNode
  });
};

scout.Tree.prototype.updateNode = function(node) {
  this.updateNodes([node]);
};

scout.Tree.prototype.updateNodes = function(nodes) {
  nodes = scout.arrays.ensure(nodes);
  nodes.forEach(function(updatedNode) {
    var propertiesChanged,
      oldNode = this.nodesMap[updatedNode.id];

    // if same instance has been updated we must set the flag always to true
    // because we cannot compare against an "old" node
    if (updatedNode === oldNode) {
      propertiesChanged = true;
    } else {
      this._applyNodeDefaultValues(updatedNode);
      propertiesChanged = this._applyUpdatedNodeProperties(oldNode, updatedNode);
    }

    if (propertiesChanged) {
      if (this._applyFiltersForNode(oldNode)) {
        if (!oldNode.isFilterAccepted()) {
          this._nodesFiltered([oldNode]);
          this._removeFromFlatList(oldNode, false);
        } else {
          this._addToVisibleFlatList(oldNode, false);
        }
      }
      this._updateItemPath(false, oldNode.parentNode);
      if (this.rendered) {
        oldNode._decorate();
      }
    }
  }, this);

  this.trigger('nodesUpdated', {
    nodes: nodes
  });
};

/**
 * Called by _onNodesUpdated for every updated node. The function is expected to apply
 * all updated properties from the updatedNode to the oldNode. May be overridden by
 * subclasses so update their specific node properties.
 *
 * @param oldNode
 *          The target node to be updated
 * @param updatedNode
 *          The new node with potentially updated properties. Default values are already applied!
 * @returns
 *          true if at least one property has changed, false otherwise. This value is used to
 *          determine if the node has to be rendered again.
 */
scout.Tree.prototype._applyUpdatedNodeProperties = function(oldNode, updatedNode) {
  // Note: We only update _some_ of the properties, because everything else will be handled
  // with separate events. --> See also: JsonTree.java/handleModelNodesUpdated()
  var propertiesChanged = false;
  if (oldNode.leaf !== updatedNode.leaf) {
    oldNode.leaf = updatedNode.leaf;
    propertiesChanged = true;
  }
  if (oldNode.enabled !== updatedNode.enabled) {
    oldNode.enabled = updatedNode.enabled;
    propertiesChanged = true;
  }
  if (oldNode.lazyExpandingEnabled !== updatedNode.lazyExpandingEnabled) {
    oldNode.lazyExpandingEnabled = updatedNode.lazyExpandingEnabled;
    // Also make sure expandedLazy is reset to false when lazyExpanding is disabled (same code as in AbstractTreeNode.setLazyExpandingEnabled)
    if (!updatedNode.lazyExpandingEnabled || !this.lazyExpandingEnabled) {
      oldNode.expandedLazy = false;
    }
    propertiesChanged = true;
  }
  return propertiesChanged;
};

scout.Tree.prototype.deleteNode = function(node, parentNode) {
  this.deleteNodes([node], parentNode);
};

scout.Tree.prototype.deleteAllNodes = function() {
  this.deleteAllChildNodes();
};

scout.Tree.prototype.deleteNodes = function(nodes, parentNode) {
  var deletedNodes = [];
  var parentNodesToReindex = [];
  var topLevelNodesToReindex = [];

  nodes = scout.arrays.ensure(nodes).slice(); // copy
  nodes.forEach(function(node) {
    var p = parentNode || node.parentNode;
    if (p) {
      if (node.parentNode !== p) {
        throw new Error('Unexpected parent. Node.parent: ' + node.parentNode + ', parentNode: ' + parentNode);
      }
      scout.arrays.remove(p.childNodes, node);
      if (parentNodesToReindex.indexOf(p) === -1) {
        parentNodesToReindex.push(p);
      }
    } else {
      scout.arrays.remove(this.nodes, node);
      topLevelNodesToReindex = this.nodes;
    }
    this._destroyTreeNode(node);
    deletedNodes.push(node);
    this._updateMarkChildrenChecked(node, false, false);

    // remove children from node map
    scout.Tree.visitNodes(this._destroyTreeNode.bind(this), node.childNodes);
  }, this);

  // update child node indices
  parentNodesToReindex.forEach(function(p) {
    this._updateChildNodeIndex(p.childNodes);
  }, this);
  this._updateChildNodeIndex(topLevelNodesToReindex);

  this.deselectNodes(deletedNodes, {collectChildren: true});
  this.uncheckNodes(deletedNodes, {collectChildren: true});

  // remove node from html document
  if (this.rendered) {
    this._removeNodes(deletedNodes, parentNode || parentNodesToReindex);
  }

  this.trigger('nodesDeleted', {
    nodes: nodes,
    parentNode: parentNode
  });
};

/**
 * @param nodes the nodes to deselect
 * @param options.collectChildren true to add the selected children to the list of nodes to deselect
 */
scout.Tree.prototype.deselectNodes = function(nodes, options) {
  nodes = scout.arrays.ensure(nodes);
  options = options || {};
  if (options.collectChildren) {
    nodes = nodes.concat(this._collectNodesIfDescendants(nodes, this.selectedNodes));
  }
  var selectedNodes = this.selectedNodes.slice(); // copy
  if (scout.arrays.removeAll(selectedNodes, nodes)) {
    this.selectNodes(selectedNodes);
  }
};

scout.Tree.prototype._collectNodesIfDescendants = function(nodes, nodesToCheck) {
  var result = [];
  nodesToCheck.forEach(function(nodeToCheck) {
    if (nodes.some(function(node) {
      return node.isAncestorOf(nodeToCheck);
    })) {
      result.push(nodeToCheck);
    }
  });
  return result;
};

scout.Tree.prototype.deleteAllChildNodes = function(parentNode) {
  var nodes;
  if (parentNode) {
    nodes = parentNode.childNodes;
    parentNode.childNodes = [];
  } else {
    nodes = this.nodes;
    this.nodes = [];
  }
  scout.Tree.visitNodes(updateNodeMap.bind(this), nodes);

  this.deselectNodes(nodes, {collectChildren: true});
  this.uncheckNodes(nodes, {collectChildren: true});

  // remove node from html document
  if (this.rendered) {
    this._removeNodes(nodes, parentNode);
  }

  this.trigger('allChildNodesDeleted', {
    parentNode: parentNode
  });

  // --- Helper functions ---

  // Update model and nodemap
  function updateNodeMap(node) {
    this._destroyTreeNode(node);
    this._updateMarkChildrenChecked(node, false, false);
  }
};

scout.Tree.prototype.updateNodeOrder = function(childNodes, parentNode) {
  childNodes = scout.arrays.ensure(childNodes);

  this._updateChildNodeIndex(childNodes);
  if (parentNode) {
    if (parentNode.childNodes.length !== childNodes.length) {
      throw new Error('Node order may not be updated because lengths of the arrays differ.');
    }
    // Make a copy so that original array stays untouched
    parentNode.childNodes = childNodes.slice();
    this._removeChildrenFromFlatList(parentNode, false);
    if (parentNode.expanded) {
      this._addChildrenToFlatList(parentNode, null, false);
    }
  } else {
    if (this.nodes.length !== childNodes.length) {
      throw new Error('Node order may not be updated because lengths of the arrays differ.');
    }
    // Make a copy so that original array stays untouched
    this.nodes = childNodes.slice();
    this.nodes.forEach(function(node) {
      this._removeFromFlatList(node, false);
      this._addToVisibleFlatList(node, false);
      if (node.expanded) {
        this._addChildrenToFlatList(node, null, false);
      }
    }, this);
  }

  this.trigger('childNodeOrderChanged', {
    parentNode: parentNode
  });
};

scout.Tree.prototype.checkNode = function(node, checked, options) {
  var opts = $.extend(options, {
    checked: checked
  });
  this.checkNodes([node], opts);
};

scout.Tree.prototype.checkNodes = function(nodes, options) {
  var opts = {
    checked: true,
    checkOnlyEnabled: true,
    checkChildren: this.autoCheckChildren,
    triggerNodesChecked: true
  };
  $.extend(opts, options);
  var updatedNodes = [];
  // use enabled computed because when the parent of the table is disabled, it should not be allowed to check rows
  if (!this.checkable || (!this.enabledComputed && opts.checkOnlyEnabled)) {
    return;
  }
  nodes = scout.arrays.ensure(nodes);
  nodes.forEach(function(node) {
    if ((!node.enabled && opts.checkOnlyEnabled) || node.checked === opts.checked) {
      if (opts.checkChildren) {
        this.checkNodes(node.childNodes, opts);
      }
      return;
    }
    if (!this.multiCheck && opts.checked) {
      for (var i = 0; i < this.checkedNodes.length; i++) {
        this.checkedNodes[i].checked = false;
        this._updateMarkChildrenChecked(this.checkedNodes[i], false, false, true);
        updatedNodes.push(this.checkedNodes[i]);
      }
      this.checkedNodes = [];
    }
    node.checked = opts.checked;
    if (node.checked) {
      this.checkedNodes.push(node);
    } else {
      scout.arrays.remove(this.checkedNodes, node);
    }
    updatedNodes.push(node);
    this._updateMarkChildrenChecked(node, false, opts.checked, true);
    if (opts.checkChildren) {
      var childOpts = $.extend({}, opts, {
        triggerNodesChecked: false
      });
      this.checkNodes(node.childNodes, childOpts);
    }
  }, this);

  if (opts.triggerNodesChecked && updatedNodes.length > 0) {
    this.trigger('nodesChecked', {
      nodes: updatedNodes
    });
  }
  if (this.rendered) {
    updatedNodes.forEach(function(node) {
      node._renderChecked();
    });
  }
};

scout.Tree.prototype.uncheckNode = function(node, options) {
  var opts = $.extend({
    checkOnlyEnabled: true
  }, options);
  this.uncheckNodes([node], opts);
};

/**
 * @param nodes the nodes to uncheck
 * @param options.collectChildren true to add the checked children to the list of nodes to uncheck
 */
scout.Tree.prototype.uncheckNodes = function(nodes, options) {
  var opts = {
    checked: false
  };
  $.extend(opts, options);
  if (opts.collectChildren) {
    nodes = nodes.concat(this._collectNodesIfDescendants(nodes, this.checkedNodes));
  }
  this.checkNodes(nodes, opts);
};

scout.Tree.prototype._triggerNodesSelected = function(debounce) {
  this.trigger('nodesSelected', {
    debounce: debounce
  });
};

scout.Tree.prototype._showContextMenu = function(event) {
  var func = function(event) {
    if (!this.rendered) { // check needed because function is called asynchronously
      return;
    }
    var filteredMenus = this._filterMenus(this.menus, scout.MenuDestinations.CONTEXT_MENU, true),
      $part = $(event.currentTarget);
    if (filteredMenus.length === 0) {
      return; // at least one menu item must be visible
    }
    // Prevent firing of 'onClose'-handler during contextMenu.open()
    // (Can lead to null-access when adding a new handler to this.contextMenu)
    if (this.contextMenu) {
      this.contextMenu.close();
    }
    this.contextMenu = scout.create('ContextMenuPopup', {
      parent: this,
      menuItems: filteredMenus,
      location: {
        x: event.pageX,
        y: event.pageY
      },
      $anchor: $part,
      menuFilter: this._filterMenusHandler
    });
    this.contextMenu.open();
  };

  this.session.onRequestsDone(func.bind(this), event);
};

scout.Tree.prototype._onNodeMouseDown = function(event) {
  this._doubleClickSupport.mousedown(event);
  if (this._doubleClickSupport.doubleClicked()) {
    //don't execute on double click events
    return false;
  }

  var $node = $(event.currentTarget);
  var node = $node.data('node');
  if (!this.hasNode(node)) {
    // if node does not belong to this tree, do nothing (may happen if another tree is embedded inside the node)
    return;
  }
  this._$mouseDownNode = $node;
  $node.window().one('mouseup', function() {
    this._$mouseDownNode = null;
  }.bind(this));

  this.selectNodes(node);

  if (this.checkable && node.enabled && this._isCheckboxClicked(event)) {
    if (scout.device.loosesFocusIfPseudoElementIsRemoved()) {
      this.focusAndPreventDefault(event);
    }
    this.checkNode(node, !node.checked);
  }
  return true;
};

scout.Tree.prototype._onNodeMouseUp = function(event) {
  if (this._doubleClickSupport.doubleClicked()) {
    //don't execute on double click events
    return false;
  }

  var $node = $(event.currentTarget);
  var node = $node.data('node');
  if (!this._$mouseDownNode || this._$mouseDownNode[0] !== $node[0]) {
    // Don't accept if mouse up happens on another node than mouse down, or mousedown didn't happen on a node at all
    return;
  }

  this.trigger('nodeClick', {
    node: node
  });
  return true;
};

scout.Tree.prototype._isCheckboxClicked = function(event) {
  // with CheckableStyle.CHECKBOX_TREE_NODE a click anywhere on the node should trigger the check
  if (this.isTreeNodeCheckEnabled()) {
    return true;
  }
  return $(event.target).is('.check-box');
};

scout.Tree.prototype._updateItemPath = function(selectionChanged, ultimate) {
  var selectedNodes, node, level;
  if (selectionChanged) {
    // first remove and select selected
    this.groupedNodes = {};

    this._inSelectionPathList = {};
  }

  if (!ultimate) {
    // find direct children
    selectedNodes = this.selectedNodes;
    if (selectedNodes.length === 0) {
      return;
    }
    node = selectedNodes[0];

    if (selectionChanged) {
      this._inSelectionPathList[node.id] = true;
      if (node.childNodes) {
        node.childNodes.forEach(function(child) {
          this._inSelectionPathList[child.id] = true;
        }.bind(this));
      }
    }
    level = node.level;

    // find grouping end (ultimate parent)
    while (node.parentNode) {
      var parent = node.parentNode;
      if (this._isGroupingEnd(parent) && !ultimate) {
        ultimate = node;
        if (!selectionChanged) {
          break;
        }
      }
      if (selectionChanged) {
        this._inSelectionPathList[parent.id] = true;
      }
      node = parent;
    }
    // find group with same ultimate parent
    ultimate = ultimate || selectedNodes[0];
    this.groupedNodes[ultimate.id] = true;
  }
  node = ultimate;
  if (node && node.expanded && this.groupedNodes[node.id]) {
    addToGroup.call(this, node.childNodes);
  }
  //------ helper function ------//

  function addToGroup(nodes) {
    nodes.forEach(function(node) {
      this.groupedNodes[node.id] = true;
      node._decorate();
      if (node.expanded && node.isFilterAccepted()) {
        addToGroup.call(this, node.childNodes);
      }
    }.bind(this));
  }
};

scout.Tree.prototype._isGroupingEnd = function(node) {
  // May be implemented by subclasses, default tree has no grouping parent
  return false;
};

/**
 * @returns {scout.TreeNode} the first selected node or null when no node is selected.
 */
scout.Tree.prototype.selectedNode = function() {
  if (this.selectedNodes.length === 0) {
    return null;
  }
  return this.selectedNodes[0];
};

scout.Tree.prototype.$selectedNodes = function() {
  return this.$data.find('.selected');
};

scout.Tree.prototype.$nodes = function() {
  return this.$data.find('.tree-node');
};

/**
 * @param filter object with createKey() and accept()
 */
scout.Tree.prototype.addFilter = function(filter, doNotFilter, notAnimated) {
  if (this._filters.indexOf(filter) < 0) {
    this._filters.push(filter);
    if (!doNotFilter) {
      this.filter(notAnimated);
    }
    return true;
  }
  return false;
};

scout.Tree.prototype.removeFilter = function(filter, notAnimated) {
  scout.arrays.remove(this._filters, filter);
  this.filter(notAnimated);
};

scout.Tree.prototype.filter = function(notAnimated) {
  var useAnimation = !!!notAnimated,
    changedNodes = [],
    newHiddenNodes = [];
  // Filter nodes
  this.visitNodes(function(node) {
    var changed = this._applyFiltersForNode(node);
    if (changed) {
      changedNodes.push(node);
      if (!node.isFilterAccepted()) {
        scout.arrays.pushAll(newHiddenNodes, this._removeFromFlatList(node, useAnimation));
      } else {
        this._addToVisibleFlatList(node, useAnimation);
      }
      this.viewRangeDirty = true;
    } else {
      // this else branch is required when the filter-state of a node has not changed
      // for instance Node "Telefon mit Sabrina" is visible for filter "tel" and also
      // for filter "abr". However, it is possible that the node is _not_ attached, when
      // we switch from one filter to another, because the node was not in the view-range
      // with the previous filter. That's why we must make sure, the node is attached to
      // the DOM, even though the filter state hasn't changed. Otherwise we'd have a
      // problem when we insert nodes in this._insertNodeInDOMAtPlace.
      if (!node.attached) {
        this.showNode(node, useAnimation);
        if (node.attached) {
          // If sibling nodes are hiding at the same time, the nodes to be shown should be added after these nodes to make the animation look correctly -> move them
          node.$node.insertAfter(node.$node.nextAll('.hiding:last'));
        }
      }
    }
    if ((node.expanded || node.expandedLazy) && node.isFilterAccepted()) {
      return false;
    }
    // don't process children->optimize performance
    return true;
  }.bind(this));

  this._nodesFiltered(newHiddenNodes);
};

/**
 * use filtered nodes are removed from visible nodes
 */
scout.Tree.prototype.filterVisibleNodes = function(animated) {
  // Filter nodes
  var newHiddenNodes = [];
  for (var i = 0; i < this.visibleNodesFlat.length; i++) {
    var node = this.visibleNodesFlat[i];
    var changed = this._applyFiltersForNode(node);
    if (changed) {
      if (!node.isFilterAccepted()) {
        i--;
        scout.arrays.pushAll(newHiddenNodes, this._removeFromFlatList(node, animated));
      }
      this.viewRangeDirty = true;
    }
  }

  this._nodesFiltered(newHiddenNodes);
};

scout.Tree.prototype._nodesFiltered = function(hiddenNodes) {
  // non visible nodes must be deselected
  this.deselectNodes(hiddenNodes);
};

scout.Tree.prototype._nodeAcceptedByFilters = function(node) {
  for (var i = 0; i < this._filters.length; i++) {
    var filter = this._filters[i];
    if (!filter.accept(node)) {
      return false;
    }
  }
  return true;
};

/**
 * @returns {Boolean} true if node state has changed, false if not
 */
scout.Tree.prototype._applyFiltersForNode = function(node) {
  var changed = node.filterDirty;
  if (this._nodeAcceptedByFilters(node)) {
    if (!node.filterAccepted) {
      node.filterAccepted = true;
      changed = true;
    }
  } else {
    if (node.filterAccepted) {
      node.filterAccepted = false;
      changed = true;
    }
  }
  if (changed) {
    node.filterDirty = false;
    node.childNodes.forEach(function(childNode) {
      childNode.filterDirty = true;
    });
    return true;
  }
  return false;
};

/**
 * Just insert node in DOM. NO check if in viewRange
 */
scout.Tree.prototype._insertNodesInDOM = function(nodes, indexHint) {
  if (!this.rendered && !this.rendering) {
    return;
  }
  nodes = nodes.filter(function(node) {
    var index = indexHint === undefined ? this.visibleNodesFlat.indexOf(node) : indexHint;
    if (index === -1 || !(this.viewRangeRendered.from + this.viewRangeSize >= index && this.viewRangeRendered.from <= index && this.viewRangeRendered.size() > 0) || node.attached) {
      // node is not visible
      return false;
    }
    if (!node.rendered) {
      this._renderNode(node);
    }
    node._decorate();
    this._insertNodeInDOMAtPlace(node, index);
    if (this.prevSelectedNode === node) {
      this._highlightPrevSelectedNode();
    }
    node.rendered = true;
    node.attached = true;
    return true;
  }, this);
  this._installNodes(nodes);
};

scout.Tree.prototype._installNodes = function(nodes) {
  // The measuring is separated into 3 blocks for performance reasons -> separates reading and setting of styles
  // 1. Prepare style for measuring
  if (this.isHorizontalScrollingEnabled()) {
    nodes.forEach(function(node) {
      node.$node.css('width', 'auto');
      node.$node.css('display', 'inline-block');
    }, this);
  }

  // 2. Measure
  nodes.forEach(function(node) {
    node.height = node.$node.outerHeight(true);
    if (!this.isHorizontalScrollingEnabled()) {
      return;
    }
    var newWidth = node.$node.outerWidth();
    var oldWidth = node.width ? node.width : 0;
    if (oldWidth === this.maxNodeWidth && newWidth < this.maxNodeWidth) {
      this.maxNodeWidth = 0;
      this.nodeWidthDirty = true;
    } else if (newWidth > this.maxNodeWidth) {
      this.maxNodeWidth = newWidth;
      this.nodeWidthDirty = true;
    }
    node.width = newWidth;
  }, this);

  // 3. Reset style
  if (this.isHorizontalScrollingEnabled()) {
    nodes.forEach(function(node) {
      if (!this.nodeWidthDirty) {
        node.$node.css('width', this.maxNodeWidth);
      }
      node.$node.css('display', '');
    }, this);
  }
};

/**
 * Attaches node to DOM, if it is visible and in view range
 * */
scout.Tree.prototype._ensureNodeInDOM = function(node, useAnimation, indexHint) {
  if (node && !node.attached && node === this.visibleNodesFlat[indexHint] && indexHint >= this.viewRangeRendered.from && indexHint < this.viewRangeRendered.to) {
    this.showNode(node, useAnimation, indexHint);
  }
};

scout.Tree.prototype._insertNodeInDOMAtPlace = function(node, index) {
  var $node = node.$node;

  if (index === 0) {
    if (this.$fillBefore) {
      $node.insertAfter(this.$fillBefore);
    } else {
      this.$data.prepend($node);
    }
    return;
  }

  // append after index
  var nodeBefore = this.visibleNodesFlat[index - 1];
  this._ensureNodeInDOM(nodeBefore, false, index - 1);
  if (nodeBefore.attached) {
    $node.insertAfter(nodeBefore.$node);
    return;
  }

  if (index + 1 < this.visibleNodesFlat.length) {
    var nodeAfter = this.visibleNodesFlat[index + 1];
    if (nodeAfter.attached) {
      $node.insertBefore(nodeAfter.$node);
      return;
    }
  }

  // used when the tree is scrolled
  if (this.$fillBefore) {
    $node.insertAfter(this.$fillBefore);
  } else {
    this.$data.prepend($node);
  }
};

scout.Tree.prototype.showNode = function(node, useAnimation, indexHint) {
  if (!this.rendered || (node.attached && !node.$node.hasClass('hiding'))) {
    return;
  }
  if (!node.attached) {
    this._ensureNodeInDOM(node.parentNode, useAnimation, indexHint - 1);
    this._insertNodesInDOM([node], indexHint);
  }
  if (!node.rendered) {
    return;
  }
  var $node = node.$node;
  if ($node.is('.showing')) {
    return;
  }
  $node.addClass('showing');
  $node.removeClass('hiding');
  var that = this;
  if (useAnimation) {
    // hide node first and then make it appear using slideDown (setVisible(false) won't work because it would stay invisible during the animation)
    $node.hide();
    $node.stop(false, true).slideDown({
      duration: 250,
      start: that.startAnimationFunc,
      complete: function() {
        that.runningAnimationsFinishFunc();
        $node.removeClass('showing');
      }
    });
  }
};

scout.Tree.prototype.hideNode = function(node, useAnimation, suppressDetachHandling) {
  if (!node.attached) {
    return;
  }
  this.viewRangeDirty = true;
  var that = this,
    $node = node.$node;
  if (!$node) {
    //node is not rendered
    return;
  }

  if ($node.is('.hiding')) {
    return;
  }

  $node.addClass('hiding');
  $node.removeClass('showing');
  if (useAnimation) {
    this._renderViewportBlocked = true;
    $node.stop(false, true).slideUp({
      duration: 250,
      start: that.startAnimationFunc,
      complete: function() {
        that.runningAnimationsFinishFunc();
        $node.removeClass('hiding');
        if (!$node.hasClass('showing')) {
          $node.detach();
          node.attached = false;
        }
      }
    });
  } else if (!suppressDetachHandling) {
    $node.detach();
    node.attached = false;
    that.invalidateLayoutTree();
  }
};

scout.Tree.prototype._nodesToIds = function(nodes) {
  return nodes.map(function(node) {
    return node.id;
  });
};

scout.Tree.prototype._nodesByIds = function(ids) {
  return ids.map(function(id) {
    return this.nodesMap[id];
  }.bind(this));
};

scout.Tree.prototype._nodeById = function(id) {
  return this.nodesMap[id];
};

scout.Tree.prototype.hasNode = function(node) {
  return !!this._nodeById(node.id);
};

scout.Tree.prototype._onNodeDoubleClick = function(event) {
  if (this.isBreadcrumbStyleActive()) {
    return;
  }

  var $node = $(event.currentTarget);
  var node = $node.data('node');
  var expanded = !$node.hasClass('expanded');
  this.doNodeAction(node, expanded);
};

scout.Tree.prototype.doNodeAction = function(node, expanded) {
  this.trigger('nodeAction', {
    node: node
  });

  // For CheckableStyle.CHECKBOX_TREE_NODE expand on double click is only enabled for disabled nodes. Otherwise it would conflict with the "check on node click" behavior.
  if (!(this.checkable === true && this.isTreeNodeCheckEnabled() && node.enabled)) {
    this.setNodeExpanded(node, expanded, {
      lazy: false // always show all nodes on node double click
    });
  }
};

scout.Tree.prototype._onNodeControlMouseDown = function(event) {
  this._doubleClickSupport.mousedown(event);
  if (this._doubleClickSupport.doubleClicked()) {
    //don't execute on double click events
    return false;
  }

  var $node = $(event.currentTarget).parent();
  var node = $node.data('node');
  var expanded = !$node.hasClass('expanded');
  var expansionOpts = {
    lazy: false // always show all nodes when the control gets clicked
  };

  // Click on "show all" control shows all nodes
  if ($node.hasClass('lazy')) {
    if (event.ctrlKey || event.shiftKey) {
      // Collapse
      expanded = false;
      expansionOpts.collapseChildNodes = true;
    } else {
      // Show all nodes
      this.expandNode(node, expansionOpts);
      return false;
    }
  }
  // Because we suppress handling by browser we have to set focus manually
  if (this.requestFocusOnNodeControlMouseDown) {
    this.focus();
  }
  this.selectNodes(node); // <---- ### 1
  this.setNodeExpanded(node, expanded, expansionOpts); // <---- ### 2
  // prevent bubbling to _onNodeMouseDown()
  $.suppressEvent(event);

  // ...but return true, so Outline.js can override this method and check if selection has been changed or not
  return true;
};

scout.Tree.prototype._onNodeControlMouseUp = function(event) {
  // prevent bubbling to _onNodeMouseUp()
  return false;
};

scout.Tree.prototype._onNodeControlDoubleClick = function(event) {
  // prevent bubbling to _onNodeDoubleClick()
  return false;
};

scout.Tree.prototype._onContextMenu = function(event) {
  event.preventDefault();
  this._showContextMenu(event);
};

scout.Tree.prototype.changeNode = function(node) {
  if (this._applyFiltersForNode(node)) {
    if (node.isFilterAccepted()) {
      this._addToVisibleFlatList(node, false);
    } else {
      this._removeFromFlatList(node, false);
    }
  }
  if (this.rendered) {
    node._decorate();
  }
  this.trigger('nodeChanged', {
    node: node
  });
};

// same as on scout.Table.prototype._onDesktopPopupOpen
scout.Tree.prototype._onDesktopPopupOpen = function(event) {
  var popup = event.popup;
  if (!this.enabled) {
    return;
  }
  // Set tree style to focused if a context menu or a menu bar popup opens, so that it looks as it still has the focus
  if (this.has(popup) && popup instanceof scout.ContextMenuPopup) {
    this.$container.addClass('focused');
    popup.one('destroy', function() {
      if (this.rendered) {
        this.$container.removeClass('focused');
      }
    }.bind(this));
  }
};

scout.Tree.prototype.updateScrollbars = function() {
  scout.scrollbars.update(this.$data);
};

/* --- STATIC HELPERS ------------------------------------------------------------- */

/**
 * @memberOf scout.Tree
 */
scout.Tree.collectSubtree = function($rootNode, includeRootNodeInResult) {
  if (!$rootNode) {
    return $();
  }
  var rootLevel = parseFloat($rootNode.attr('data-level'));
  // Find first node after the root element that has the same or a lower level
  var $nextNode = $rootNode.next();
  while ($nextNode.length > 0) {
    var level = parseFloat($nextNode.attr('data-level'));
    if (isNaN(level) || level <= rootLevel) {
      break;
    }
    $nextNode = $nextNode.next();
  }

  // The result set consists of all nodes between the root node and the found node
  var $result = $rootNode.nextUntil($nextNode);
  if (includeRootNodeInResult === undefined || includeRootNodeInResult) {
    $result = $result.add($rootNode);
  }
  return $result;
};

/**
 * pre-order (top-down) traversal of the tree-nodes provided.<br>
 * if func returns true the children of the visited node are not visited.
 */
scout.Tree.visitNodes = function(func, nodes, parentNode) {
  var i, node;
  if (!nodes) {
    return;
  }

  for (i = 0; i < nodes.length; i++) {
    node = nodes[i];
    var doNotProcessChildren = func(node, parentNode);
    if (!doNotProcessChildren && node.childNodes.length > 0) {
      scout.Tree.visitNodes(func, node.childNodes, node);
    }
  }
};
