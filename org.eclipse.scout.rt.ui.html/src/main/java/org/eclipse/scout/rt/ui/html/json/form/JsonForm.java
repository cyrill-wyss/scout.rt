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
package org.eclipse.scout.rt.ui.html.json.form;

import org.eclipse.scout.commons.Assertions;
import org.eclipse.scout.commons.exception.ProcessingException;
import org.eclipse.scout.commons.logger.IScoutLogger;
import org.eclipse.scout.commons.logger.ScoutLogManager;
import org.eclipse.scout.rt.client.IClientSession;
import org.eclipse.scout.rt.client.ui.IEventHistory;
import org.eclipse.scout.rt.client.ui.desktop.DesktopEvent;
import org.eclipse.scout.rt.client.ui.desktop.DesktopListener;
import org.eclipse.scout.rt.client.ui.desktop.IDesktop;
import org.eclipse.scout.rt.client.ui.form.FormEvent;
import org.eclipse.scout.rt.client.ui.form.FormListener;
import org.eclipse.scout.rt.client.ui.form.IForm;
import org.eclipse.scout.rt.client.ui.form.fields.IFormField;
import org.eclipse.scout.rt.client.ui.form.fields.button.IButton;
import org.eclipse.scout.rt.shared.ISession;
import org.eclipse.scout.rt.ui.html.IUiSession;
import org.eclipse.scout.rt.ui.html.json.AbstractJsonPropertyObserver;
import org.eclipse.scout.rt.ui.html.json.IJsonAdapter;
import org.eclipse.scout.rt.ui.html.json.JsonAdapterUtility;
import org.eclipse.scout.rt.ui.html.json.JsonEvent;
import org.eclipse.scout.rt.ui.html.json.JsonProperty;
import org.eclipse.scout.rt.ui.html.res.BinaryResourceUrlUtility;
import org.json.JSONObject;

public class JsonForm<FORM extends IForm> extends AbstractJsonPropertyObserver<FORM> {
  private static final IScoutLogger LOG = ScoutLogManager.getLogger(JsonForm.class);

  public static final String PROP_FORM_ID = "formId";
  public static final String PROP_TITLE = IForm.PROP_TITLE;
  public static final String PROP_SUB_TITLE = IForm.PROP_SUB_TITLE;
  public static final String PROP_ICON_ID = IForm.PROP_ICON_ID;
  public static final String PROP_MODAL = "modal";
  public static final String PROP_MODALITY_HINT = "modalityHint";
  public static final String PROP_DISPLAY_HINT = "displayHint";
  public static final String PROP_DISPLAY_VIEW_ID = "displayViewId";
  public static final String PROP_CLOSABLE = "closable";
  public static final String PROP_FORM_FIELD = "formField";
  public static final String PROP_ROOT_GROUP_BOX = "rootGroupBox";
  public static final String PROP_INITIAL_FOCUS = "initialFocus";
  public static final String PROP_FORM = "form";

  public static final String EVENT_FORM_CLOSING = "formClosing";
  public static final String EVENT_FORM_CLOSED = "formClosed";
  public static final String EVENT_REQUEST_FOCUS = "requestFocus";

  private FormListener m_formListener;

  private DesktopListener m_desktopListener;
  private final FormParentFilter m_formFormFilter;

  public JsonForm(FORM form, IUiSession uiSession, String id, IJsonAdapter<?> parent) {
    super(form, uiSession, id, parent);
    m_formFormFilter = new FormParentFilter(form);
  }

  @Override
  public String getObjectType() {
    return "Form";
  }

  @Override
  protected void initJsonProperties(FORM model) {
    super.initJsonProperties(model);
    putJsonProperty(new JsonProperty<IForm>(PROP_TITLE, model) {
      @Override
      protected String modelValue() {
        return getModel().getTitle();
      }
    });
    putJsonProperty(new JsonProperty<IForm>(PROP_SUB_TITLE, model) {
      @Override
      protected String modelValue() {
        return getModel().getSubTitle();
      }
    });
    putJsonProperty(new JsonProperty<IForm>(PROP_ICON_ID, model) {
      @Override
      protected String modelValue() {
        return getModel().getIconId();
      }

      @Override
      public Object prepareValueForToJson(Object value) {
        return BinaryResourceUrlUtility.createIconUrl((String) value);
      }
    });
  }

  @Override
  protected void attachChildAdapters() {
    super.attachChildAdapters();
    attachAdapter(getModel().getRootGroupBox());

    attachAdapters(getDesktop().getViews(getModel()));
    attachAdapters(getDesktop().getDialogs(getModel()));
    attachAdapters(getDesktop().getMessageBoxes(getModel()));
  }

  @Override
  protected void attachModel() {
    super.attachModel();

    // FormListener
    Assertions.assertNull(m_formListener);
    m_formListener = new P_FormListener();
    getModel().addFormListener(m_formListener);

    // DesktopListener
    Assertions.assertNull(m_desktopListener);
    m_desktopListener = new P_DesktopListener();
    getDesktop().addDesktopListener(m_desktopListener);
  }

  @Override
  protected void detachModel() {
    // FormListener
    Assertions.assertNotNull(m_formListener);
    getModel().removeFormListener(m_formListener);
    m_formListener = null;

    // DesktopListener
    Assertions.assertNotNull(m_desktopListener);
    getDesktop().removeDesktopListener(m_desktopListener);
    m_desktopListener = null;

    super.detachModel();
  }

  @Override
  public JSONObject toJson() {
    JSONObject json = super.toJson();
    IForm model = getModel();
    putProperty(json, PROP_MODAL, model.isModal());
    putProperty(json, PROP_MODALITY_HINT, modalityHintToJson(model.getModalityHint()));
    putProperty(json, PROP_DISPLAY_HINT, displayHintToJson(model.getDisplayHint()));
    putProperty(json, PROP_DISPLAY_VIEW_ID, model.getDisplayViewId());
    putProperty(json, PROP_CLOSABLE, isClosable());
    putAdapterIdProperty(json, PROP_ROOT_GROUP_BOX, model.getRootGroupBox());
    setInitialFocusProperty(json);
    putAdapterIdsProperty(json, "views", getDesktop().getViews(getModel()));
    putAdapterIdsProperty(json, "dialogs", getDesktop().getDialogs(getModel()));
    putAdapterIdsProperty(json, "messageBoxes", getDesktop().getMessageBoxes(getModel()));
    return json;
  }

  public void setInitialFocusProperty(JSONObject json) {
    //check for request focus events in history
    IEventHistory<FormEvent> h = getModel().getEventHistory();
    if (h != null) {
      for (FormEvent e : h.getRecentEvents()) {
        if (e.getType() == FormEvent.TYPE_REQUEST_FOCUS) {
          IJsonAdapter<?> formFieldAdapter = JsonAdapterUtility.findChildAdapter(this, e.getFormField());
          if (formFieldAdapter == null) {
            LOG.error("Cannot handle requestFocus event, because adapter for " + e.getFormField() + " could not be resolved in " + toString());
            return;
          }

          putProperty(json, PROP_INITIAL_FOCUS, formFieldAdapter.getId());
        }
      }
    }
  }

  protected boolean isClosable() {
    for (IFormField f : getModel().getAllFields()) {
      if (f.isEnabled() && f.isVisible() && (f instanceof IButton)) {
        switch (((IButton) f).getSystemType()) {
          case IButton.SYSTEM_TYPE_CLOSE:
          case IButton.SYSTEM_TYPE_CANCEL: {
            return true;
          }
        }
      }
    }
    return false;
  }

  protected String displayHintToJson(int displayHint) {
    switch (displayHint) {
      case IForm.DISPLAY_HINT_DIALOG:
        return "dialog";
      case IForm.DISPLAY_HINT_VIEW:
        return "view";
      case IForm.DISPLAY_HINT_POPUP_DIALOG:
        return "popupDialog";
      case IForm.DISPLAY_HINT_POPUP_WINDOW:
        return "popupWindow";
      default:
        return null;
    }
  }

  protected String modalityHintToJson(int modalityHint) {
    switch (modalityHint) {
      case IForm.MODALITY_HINT_NONE:
        return "none";
      case IForm.MODALITY_HINT_PARENT:
        return "parent";
      case IForm.MODALITY_HINT_APPLICATION:
        return "application";
      default:
        return null;
    }
  }

  protected IDesktop getDesktop() {
    IClientSession session = getUiSession().getClientSession(); // TODO dwi
    if (session == null) {
      session = (IClientSession) ISession.CURRENT.get();
    }

    return session.getDesktop();
  }

  // ==== FormListener === /
  protected void handleModelFormChanged(FormEvent event) {
    switch (event.getType()) {
      case FormEvent.TYPE_CLOSED:
        handleModelFormClosed(event.getForm());
        break;
      case FormEvent.TYPE_REQUEST_FOCUS:
        handleModelRequestFocus(event.getFormField());
        break;
      default:
        // NOP
    }
  }

  protected void handleModelFormClosed(IForm form) {
    // There is no need to send a 'formRemoved' event to the desktop. The UI will assume 'formRemoved' implicitly,
    // when it encounters a 'formClosed' event (see Form.js/_onFormClosed).
    dispose();
    // Important: The following event must be send _after_ the dispose() call! Otherwise,
    // it would be deleted automatically from the JSON response. This is a special case
    // where we explicitly want to send an event for an already disposed adapter.
//    addActionEvent(EVENT_FORM_CLOSED);
  }

  protected void handleModelRequestFocus(IFormField formField) {
    IJsonAdapter<?> formFieldAdapter = JsonAdapterUtility.findChildAdapter(this, formField);
    if (formFieldAdapter == null) {
      LOG.error("Cannot handle requestFocus event, because adapter for " + formField + " could not be resolved in " + toString());
      return;
    }

    JSONObject jsonEvent = new JSONObject();
    putProperty(jsonEvent, PROP_FORM_FIELD, formFieldAdapter.getId());
    addActionEvent(EVENT_REQUEST_FOCUS, jsonEvent);
  }

  // ==== UIListener === /

  @Override
  public void handleUiEvent(JsonEvent event) {
    if (EVENT_FORM_CLOSING.equals(event.getType())) {
      handleUiFormClosing(event);
    }
  }

  public void handleUiFormClosing(JsonEvent event) {
    getModel().getUIFacade().fireFormClosingFromUI();
  }

  // ==== DesktopListener === /
  protected void handleModelDesktopEvent(DesktopEvent event) {
    switch (event.getType()) {
      case DesktopEvent.TYPE_FORM_ADDED:
        handleModelFormAdded(event.getForm());
        break;
      case DesktopEvent.TYPE_FORM_REMOVED:
        handleModelFormRemoved(event.getForm());
        break;
      case DesktopEvent.TYPE_FORM_ENSURE_VISIBLE:
        handleModelFormEnsureVisible(event.getForm());
        break;
      default:
        // NOOP
    }
  }

  protected void handleModelFormAdded(IForm form) {
    IJsonAdapter<?> jsonAdapter = attachAdapter(form, m_formFormFilter);
    if (jsonAdapter != null) {
      addActionEvent("formAdded", new JSONObject().put(PROP_FORM, jsonAdapter.getId()));
    }
  }

  protected void handleModelFormRemoved(IForm form) {
    IJsonAdapter<?> jsonAdapter = getAdapter(form, m_formFormFilter);
    if (jsonAdapter != null) {
      addActionEvent("formRemoved", new JSONObject().put(PROP_FORM, jsonAdapter.getId()));
    }
  }

  protected void handleModelFormEnsureVisible(IForm form) {
    IJsonAdapter<?> jsonAdapter = getAdapter(form, m_formFormFilter);
    if (jsonAdapter != null) {
      addActionEvent("formEnsureVisible", new JSONObject().put(PROP_FORM, jsonAdapter.getId()));
    }
  }

  protected class P_FormListener implements FormListener {

    @Override
    public void formChanged(FormEvent e) throws ProcessingException {
      handleModelFormChanged(e);
    }
  }

  protected class P_DesktopListener implements DesktopListener {

    @Override
    public void desktopChanged(DesktopEvent e) {
      handleModelDesktopEvent(e);
    }
  }
}
