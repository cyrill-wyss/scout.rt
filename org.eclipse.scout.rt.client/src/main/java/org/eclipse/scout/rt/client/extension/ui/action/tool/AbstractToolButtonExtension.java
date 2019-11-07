/*******************************************************************************
 * Copyright (c) 2010-2015 BSI Business Systems Integration AG.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     BSI Business Systems Integration AG - initial API and implementation
 ******************************************************************************/
package org.eclipse.scout.rt.client.extension.ui.action.tool;

import org.eclipse.scout.rt.client.extension.ui.action.menu.AbstractMenuExtension;
import org.eclipse.scout.rt.client.ui.action.tool.AbstractToolButton;

/**
 * @deprecated use {@link AbstractMenuExtension} instead, will be removed in Scout 6.1
 */
@Deprecated
@SuppressWarnings("deprecation")
public abstract class AbstractToolButtonExtension<OWNER extends AbstractToolButton> extends AbstractMenuExtension<OWNER> implements IToolButtonExtension<OWNER> {

  public AbstractToolButtonExtension(OWNER owner) {
    super(owner);
  }
}