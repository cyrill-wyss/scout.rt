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
package org.eclipse.scout.rt.dataobject.migration.fixture.house;

import java.util.List;
import java.util.Set;

import org.eclipse.scout.rt.dataobject.DoEntityBuilder;
import org.eclipse.scout.rt.dataobject.IDoEntity;
import org.eclipse.scout.rt.dataobject.ITypeVersion;
import org.eclipse.scout.rt.dataobject.migration.AbstractDoStructureMigrationHandler;
import org.eclipse.scout.rt.dataobject.migration.DoStructureMigrationContext;
import org.eclipse.scout.rt.dataobject.migration.fixture.version.CharlieFixtureTypeVersions.CharlieFixture_2;
import org.eclipse.scout.rt.platform.BEANS;
import org.eclipse.scout.rt.platform.IgnoreBean;
import org.eclipse.scout.rt.platform.util.CollectionUtility;

/**
 * Add relation and if name is "example", create an example child entry.
 */
@IgnoreBean
public class PersonFixtureDoStructureMigrationHandler_2 extends AbstractDoStructureMigrationHandler {

  @Override
  public Class<? extends ITypeVersion> toTypeVersionClass() {
    return CharlieFixture_2.class;
  }

  /**
   * References {@link PersonFixtureDo}.
   */
  @Override
  public Set<String> getTypeNames() {
    return CollectionUtility.hashSet("charlieFixture.PersonFixture");
  }

  @Override
  protected boolean migrate(DoStructureMigrationContext ctx, IDoEntity doEntity) {
    if (doEntity.has("relation")) {
      return false; // already migrated
    }

    PersonFixtureTargetContextData personContextData = ctx.get(PersonFixtureTargetContextData.class);
    String relation = personContextData == null ? "(none)" : "Child of " + personContextData.getName();
    doEntity.put("relation", relation);

    if ("example".equals(doEntity.getString("name"))) {
      List<IDoEntity> children = doEntity.getList("children", IDoEntity.class);
      children.add(BEANS.get(DoEntityBuilder.class)
          .put("_type", "charlieFixture.PersonFixture")
          // when no type version is added or charlieFixture-1 is used, this migration handler would be called for the added child too
          .put("_typeVersion", CharlieFixture_2.VERSION.unwrap())
          .put("name", "Jane Doe")
          .put("relation", "(undefined)")
          .build());
    }

    return true;
  }
}
