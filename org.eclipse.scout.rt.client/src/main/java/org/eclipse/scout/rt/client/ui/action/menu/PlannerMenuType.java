/*******************************************************************************
 * Copyright (c) 2010 BSI Business Systems Integration AG.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     BSI Business Systems Integration AG - initial API and implementation
 ******************************************************************************/
package org.eclipse.scout.rt.client.ui.action.menu;

/**
 * All possible menus types of a activity map menu. This menu types are used of
 * {@link AbstractMenu#getConfiguredMenuTypes()} method.
 */
public enum PlannerMenuType implements IMenuType {
  Selection,
  Activity
}
