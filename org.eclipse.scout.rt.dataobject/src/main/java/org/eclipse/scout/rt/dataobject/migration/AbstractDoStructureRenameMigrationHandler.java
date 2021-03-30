/*
 * Copyright (c) 2010-2021 BSI Business Systems Integration AG.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     BSI Business Systems Integration AG - initial API and implementation
 */
package org.eclipse.scout.rt.dataobject.migration;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;

import org.eclipse.scout.rt.dataobject.IDoEntity;
import org.eclipse.scout.rt.platform.BEANS;

/**
 * Abstract implementation of a {@link IDoStructureMigrationHandler} supporting simple definition of type name and
 * attribute name renamings.
 */
public abstract class AbstractDoStructureRenameMigrationHandler extends AbstractDoStructureMigrationHandler {

  protected final Map<String, String> m_typeNameTranslations = new HashMap<>();
  protected final Map<String, Map<String, String>> m_attributNameTranslations = new HashMap<>();

  protected AbstractDoStructureRenameMigrationHandler() {
    initTypeNameTranslations(m_typeNameTranslations);
    initAttributeNameTranslations(m_attributNameTranslations);
  }

  /**
   * Add type name translations.
   * <p>
   * Example renames the data object with type name "example.Lorem" to "example.Ipsum".
   *
   * <pre>
   * typeNameTranslations.put("example.Lorem", "example.Ipsum");
   * </pre>
   */
  protected void initTypeNameTranslations(Map<String, String> typeNameTranslations) {
  }

  /**
   * Add attribute name translations.
   * <p>
   * Example renames the attribute "ipsum" to "dolor" in the data object with type name "example.Lorem" (new type name
   * if renamed in {@link #initTypeNameTranslations(Map)}).
   *
   * <pre>
   * attributNameTranslations.put("example.Lorem", CollectionUtility.hashMap(new ImmutablePair<>("ipsum", "dolor")));
   * </pre>
   */
  protected void initAttributeNameTranslations(Map<String, Map<String, String>> attributNameTranslations) {
  }

  @Override
  public Set<String> getTypeNames() {
    Set<String> typeNames = new HashSet<>();
    typeNames.addAll(m_typeNameTranslations.keySet());
    typeNames.addAll(m_attributNameTranslations.keySet());
    return typeNames;
  }

  @Override
  protected boolean migrate(DoStructureMigrationContext ctx, IDoEntity doEntity) {
    DoStructureMigrationHelper helper = BEANS.get(DoStructureMigrationHelper.class);
    boolean changed = false;
    String typeName = helper.getType(doEntity);
    if (m_typeNameTranslations.containsKey(typeName)) {
      typeName = m_typeNameTranslations.get(typeName);
      helper.setType(doEntity, typeName);
      changed = true;
    }

    if (m_attributNameTranslations.containsKey(typeName)) {
      Map<String, String> attributeTranslations = m_attributNameTranslations.get(typeName);
      for (Entry<String, String> entry : attributeTranslations.entrySet()) {
        String name = entry.getKey();
        String newName = entry.getValue();
        changed |= helper.renameAttribute(doEntity, name, newName);
      }
    }

    return changed;
  }
}
