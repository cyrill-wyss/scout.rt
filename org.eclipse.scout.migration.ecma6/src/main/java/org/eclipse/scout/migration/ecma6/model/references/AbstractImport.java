/*
 * Copyright (c) 2010-2019 BSI Business Systems Integration AG.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     BSI Business Systems Integration AG - initial API and implementation
 */
package org.eclipse.scout.migration.ecma6.model.references;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.eclipse.scout.migration.ecma6.context.Context;

public abstract class AbstractImport<T extends AbstractImport> implements IImport {

  private AliasedMember m_defaultMember;
  private List<AliasedMember> m_members = new ArrayList<>();


  public T withMember(AliasedMember member){
    m_members.add(member);
    return (T) this;
  }

  public void addMember(AliasedMember member){
    m_members.add(member);
  }

  public List<AliasedMember> getMembers() {
    return Collections.unmodifiableList(m_members);
  }

  public T withDefaultMember(AliasedMember defaultMember){
    m_defaultMember = defaultMember;
    return (T) this;
  }

  public AliasedMember getDefaultMember() {
    return m_defaultMember;
  }

  public AliasedMember findAliasedMember(String member){
    if(m_defaultMember != null && m_defaultMember.getName().equals(member)){
      return m_defaultMember;
    }
    return m_members.stream().filter(am -> am.getName().equals(member))
      .findFirst().orElse(null);
  }

  public void setDefaultMember(AliasedMember defaultMember){
    m_defaultMember = defaultMember;
  }
  public abstract  String getModuleName();

  @Override
  public String toSource(Context context) {
    StringBuilder sourceBuilder = new StringBuilder();
    sourceBuilder.append("import");
    if(m_defaultMember != null){
      sourceBuilder.append(" ").append(
        Optional.ofNullable(getDefaultMember().getAlias())
          .orElse(getDefaultMember().getName()));
    }
    if(m_members.size() > 0){
      sourceBuilder.append(" {");
      sourceBuilder.append(m_members.stream().map(m -> {
        StringBuilder b = new StringBuilder();
        b.append(m.getName());
        if(m.getAlias() != null){
          b.append(" as ").append(m.getAlias());
        }
        return b.toString();
      }).collect(Collectors.joining(", ")));
      sourceBuilder.append("}");
    }
    sourceBuilder.append(" from")

      .append(" '")
      .append(getModuleName())
      .append("';");
    return sourceBuilder.toString();
  }
}