/*
 * Copyright (c) BSI Business Systems Integration AG. All rights reserved.
 * http://www.bsiag.com/
 */
package org.eclipse.scout.rt.jackson.dataobject.fixture;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.Arrays;
import java.util.Collection;
import java.util.Date;
import java.util.List;

import javax.annotation.Generated;

import org.eclipse.scout.rt.platform.dataobject.AttributeName;
import org.eclipse.scout.rt.platform.dataobject.DoEntity;
import org.eclipse.scout.rt.platform.dataobject.DoList;
import org.eclipse.scout.rt.platform.dataobject.DoValue;
import org.eclipse.scout.rt.platform.dataobject.TypeName;

@TypeName("TestRenamedAttribute")
public class TestRenamedAttributeDo extends DoEntity {

  public DoValue<String> has() {
    return doValue("has");
  }

  public DoValue<String> get() {
    return doValue("get");
  }

  @AttributeName("put")
  public DoValue<String> put() {
    return doValue("put");
  }

  @AttributeName("all")
  public DoValue<BigDecimal> allAttribute() {
    return doValue("all");
  }

  @AttributeName("dateAttributeCustomName")
  public DoValue<Date> dateAttribute() {
    return doValue("dateAttributeCustomName");
  }

  @AttributeName("hashCode")
  public DoValue<Integer> hashCodeAttribute() {
    return doValue("hashCode");
  }

  @AttributeName("wait")
  public DoValue<Integer> waitAttribute() {
    return doValue("wait");
  }

  @AttributeName("clone")
  public DoList<BigDecimal> cloneAttribute() {
    return doList("clone");
  }

  @AttributeName("finalize")
  public DoValue<List<BigInteger>> finalizeAttribute() {
    return doValue("finalize");
  }

  /* **************************************************************************
   * GENERATED CONVENIENCE METHODS
   * *************************************************************************/

  @Generated("DoConvenienceMethodsGenerator")
  public TestRenamedAttributeDo withHas(String has) {
    has().set(has);
    return this;
  }

  @Generated("DoConvenienceMethodsGenerator")
  public String getHas() {
    return has().get();
  }

  @Generated("DoConvenienceMethodsGenerator")
  public TestRenamedAttributeDo withGet(String get) {
    get().set(get);
    return this;
  }

  @Generated("DoConvenienceMethodsGenerator")
  public String getGet() {
    return get().get();
  }

  @Generated("DoConvenienceMethodsGenerator")
  public TestRenamedAttributeDo withPut(String put) {
    put().set(put);
    return this;
  }

  @Generated("DoConvenienceMethodsGenerator")
  public String getPut() {
    return put().get();
  }

  @Generated("DoConvenienceMethodsGenerator")
  public TestRenamedAttributeDo withAllAttribute(BigDecimal allAttribute) {
    allAttribute().set(allAttribute);
    return this;
  }

  @Generated("DoConvenienceMethodsGenerator")
  public BigDecimal getAllAttribute() {
    return allAttribute().get();
  }

  @Generated("DoConvenienceMethodsGenerator")
  public TestRenamedAttributeDo withDateAttribute(Date dateAttribute) {
    dateAttribute().set(dateAttribute);
    return this;
  }

  @Generated("DoConvenienceMethodsGenerator")
  public Date getDateAttribute() {
    return dateAttribute().get();
  }

  @Generated("DoConvenienceMethodsGenerator")
  public TestRenamedAttributeDo withHashCodeAttribute(Integer hashCodeAttribute) {
    hashCodeAttribute().set(hashCodeAttribute);
    return this;
  }

  @Generated("DoConvenienceMethodsGenerator")
  public Integer getHashCodeAttribute() {
    return hashCodeAttribute().get();
  }

  @Generated("DoConvenienceMethodsGenerator")
  public TestRenamedAttributeDo withWaitAttribute(Integer waitAttribute) {
    waitAttribute().set(waitAttribute);
    return this;
  }

  @Generated("DoConvenienceMethodsGenerator")
  public Integer getWaitAttribute() {
    return waitAttribute().get();
  }

  @Generated("DoConvenienceMethodsGenerator")
  public TestRenamedAttributeDo withCloneAttribute(Collection<? extends BigDecimal> cloneAttribute) {
    cloneAttribute().clear();
    cloneAttribute().get().addAll(cloneAttribute);
    return this;
  }

  @Generated("DoConvenienceMethodsGenerator")
  public TestRenamedAttributeDo withCloneAttribute(BigDecimal... cloneAttribute) {
    return withCloneAttribute(Arrays.asList(cloneAttribute));
  }

  @Generated("DoConvenienceMethodsGenerator")
  public List<BigDecimal> getCloneAttribute() {
    return cloneAttribute().get();
  }

  @Generated("DoConvenienceMethodsGenerator")
  public TestRenamedAttributeDo withFinalizeAttribute(List<BigInteger> finalizeAttribute) {
    finalizeAttribute().set(finalizeAttribute);
    return this;
  }

  @Generated("DoConvenienceMethodsGenerator")
  public List<BigInteger> getFinalizeAttribute() {
    return finalizeAttribute().get();
  }
}
