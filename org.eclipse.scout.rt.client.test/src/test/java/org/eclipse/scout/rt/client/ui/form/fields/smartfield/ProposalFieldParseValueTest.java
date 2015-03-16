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
package org.eclipse.scout.rt.client.ui.form.fields.smartfield;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import java.util.Collections;
import java.util.List;

import org.eclipse.scout.commons.CollectionUtility;
import org.eclipse.scout.commons.annotations.ClassId;
import org.eclipse.scout.commons.exception.ProcessingException;
import org.eclipse.scout.rt.client.testenvironment.TestEnvironmentClientSession;
import org.eclipse.scout.rt.shared.services.lookup.ILookupCall;
import org.eclipse.scout.rt.shared.services.lookup.ILookupRow;
import org.eclipse.scout.rt.shared.services.lookup.ILookupService;
import org.eclipse.scout.rt.shared.services.lookup.LookupCall;
import org.eclipse.scout.rt.shared.services.lookup.LookupRow;
import org.eclipse.scout.rt.testing.client.runner.ClientTestRunner;
import org.eclipse.scout.rt.testing.client.runner.RunWithClientSession;
import org.eclipse.scout.rt.testing.platform.runner.RunWithSubject;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 *
 */
@RunWith(ClientTestRunner.class)
@RunWithSubject("default")
@RunWithClientSession(TestEnvironmentClientSession.class)
public class ProposalFieldParseValueTest {

  @Test
  public void testSingleMatch() throws ProcessingException {
    ProposalField field = new ProposalField();
    // single match
    field.getUIFacade().setTextFromUI("a");
    assertEquals("a", field.getValue());
    // select proposal
    assertNotNull(field.getProposalChooser().getModel());
    field.getProposalChooser().forceProposalSelection();
    field.getProposalChooser().doOk();
    assertEquals("aName", field.getValue());
    assertNull(field.getProposalChooser().getModel());

  }

  // FIXME AWE: braucht es die methode getSearchResult noch?

//  @Test
//  public void testMultiMatch() throws ProcessingException {
//    ProposalField field = new ProposalField();
//    // match with two elements
//    field.getUIFacade().setTextFromUI("b");
//    assertEquals("b", field.getValue());
//    assertNotNull(field.getProposalChooser().getModel());
//    assertEquals(2, field.getProposalChooser().getSearchResult().getLookupRows().size());
//    // select first
//    field.getProposalChooser().forceProposalSelection();
//    // close the proposal form
//    field.getProposalChooser().doOk();
//    assertNull(field.getProposalChooser().getModel());
//    assertEquals("aName", field.getValue());
//  }

  @Test
  public void testNoMatch() throws ProcessingException {
    ProposalField field = new ProposalField();
    // single match
    field.getUIFacade().setTextFromUI("c");
    assertEquals("c", field.getValue());
    assertNull(field.getProposalChooser().getModel());

  }

  private static class ProposalField extends AbstractProposalField<Long> {
    @Override
    protected Class<? extends ILookupCall<Long>> getConfiguredLookupCall() {
      return P_LookupCall.class;
    }
  }

  @ClassId("ad1b3fc1-4b33-4c7d-9506-a6e36618f77f")
  public static class P_LookupCall extends LookupCall<Long> {

    private static final long serialVersionUID = 1L;

    @Override
    protected ILookupService<Long> createLookupService() {
      return new P_LookupService();
    }

  }

  public static class P_LookupService implements ILookupService<Long> {

    @Override
    public List<? extends ILookupRow<Long>> getDataByKey(ILookupCall<Long> call) throws ProcessingException {
      return null;
    }

    @Override
    public List<? extends ILookupRow<Long>> getDataByText(ILookupCall<Long> call) throws ProcessingException {
      if ("a*".equals(call.getText())) {
        return CollectionUtility.arrayList(new LookupRow<Long>(1L, "aName"));
      }
      if ("b*".equals(call.getText())) {
        return CollectionUtility.arrayList(new LookupRow<Long>(1L, "aName"), new LookupRow<Long>(2L, "bName"));
      }
      return Collections.emptyList();
    }

    @Override
    public List<? extends ILookupRow<Long>> getDataByAll(ILookupCall<Long> call) throws ProcessingException {
      return null;
    }

    @Override
    public List<? extends ILookupRow<Long>> getDataByRec(ILookupCall<Long> call) throws ProcessingException {
      return null;
    }

  }
}
