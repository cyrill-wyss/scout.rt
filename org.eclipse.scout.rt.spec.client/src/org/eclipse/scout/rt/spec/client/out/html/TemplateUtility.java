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
package org.eclipse.scout.rt.spec.client.out.html;

import java.io.File;

import org.eclipse.scout.commons.exception.ProcessingException;
import org.eclipse.scout.rt.spec.client.SpecIOUtility;
import org.eclipse.scout.rt.spec.client.internal.Activator;

/**
 *
 */
public final class TemplateUtility {
  private static final String DEFAULT_CSS = "resources/style/default.css";

  private TemplateUtility() {
  }

  public static void copyDefaultCss(File destFile) throws ProcessingException {
    SpecIOUtility.copyFile(Activator.getDefault().getBundle(), DEFAULT_CSS, destFile);
  }

}
