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
package org.eclipse.scout.rt.client;

import java.beans.PropertyChangeListener;
import java.net.URI;
import java.net.URISyntaxException;
import java.security.AccessController;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import javax.security.auth.Subject;

import org.eclipse.scout.commons.Assertions;
import org.eclipse.scout.commons.CollectionUtility;
import org.eclipse.scout.commons.CollectorVisitor;
import org.eclipse.scout.commons.EventListenerList;
import org.eclipse.scout.commons.TypeCastUtility;
import org.eclipse.scout.commons.annotations.ConfigOperation;
import org.eclipse.scout.commons.annotations.ConfigProperty;
import org.eclipse.scout.commons.annotations.Internal;
import org.eclipse.scout.commons.annotations.Order;
import org.eclipse.scout.commons.beans.AbstractPropertyObserver;
import org.eclipse.scout.commons.exception.ProcessingException;
import org.eclipse.scout.commons.logger.IScoutLogger;
import org.eclipse.scout.commons.logger.ScoutLogManager;
import org.eclipse.scout.commons.nls.NlsLocale;
import org.eclipse.scout.commons.security.SimplePrincipal;
import org.eclipse.scout.rt.client.ClientConfigProperties.JobCompletionDelayOnSessionShutdown;
import org.eclipse.scout.rt.client.ClientConfigProperties.MemoryPolicyProperty;
import org.eclipse.scout.rt.client.extension.ClientSessionChains.ClientSessionLoadSessionChain;
import org.eclipse.scout.rt.client.extension.ClientSessionChains.ClientSessionStoreSessionChain;
import org.eclipse.scout.rt.client.extension.IClientSessionExtension;
import org.eclipse.scout.rt.client.job.ClientJobs;
import org.eclipse.scout.rt.client.ui.ClientUIPreferences;
import org.eclipse.scout.rt.client.ui.DataChangeListener;
import org.eclipse.scout.rt.client.ui.desktop.DesktopListener;
import org.eclipse.scout.rt.client.ui.desktop.IDesktop;
import org.eclipse.scout.rt.client.ui.desktop.internal.VirtualDesktop;
import org.eclipse.scout.rt.platform.BEANS;
import org.eclipse.scout.rt.platform.config.CONFIG;
import org.eclipse.scout.rt.platform.context.PropertyMap;
import org.eclipse.scout.rt.platform.job.IFuture;
import org.eclipse.scout.rt.platform.job.JobFutureFilters.Filter;
import org.eclipse.scout.rt.platform.job.Jobs;
import org.eclipse.scout.rt.platform.util.NumberUtility;
import org.eclipse.scout.rt.shared.OfflineState;
import org.eclipse.scout.rt.shared.ScoutTexts;
import org.eclipse.scout.rt.shared.extension.AbstractExtension;
import org.eclipse.scout.rt.shared.extension.IExtensibleObject;
import org.eclipse.scout.rt.shared.extension.IExtension;
import org.eclipse.scout.rt.shared.extension.ObjectExtensions;
import org.eclipse.scout.rt.shared.services.common.context.SharedVariableMap;
import org.eclipse.scout.rt.shared.services.common.ping.IPingService;
import org.eclipse.scout.rt.shared.services.common.prefs.IPreferences;
import org.eclipse.scout.rt.shared.services.common.security.ILogoutService;
import org.eclipse.scout.rt.shared.session.IGlobalSessionListener;
import org.eclipse.scout.rt.shared.session.ISessionListener;
import org.eclipse.scout.rt.shared.session.SessionEvent;
import org.eclipse.scout.rt.shared.ui.UserAgent;

public abstract class AbstractClientSession extends AbstractPropertyObserver implements IClientSession, IExtensibleObject {

  private static final IScoutLogger LOG = ScoutLogManager.getLogger(AbstractClientSession.class);

  private final EventListenerList m_eventListeners;

  // state
  private final Object m_stateLock;
  private volatile boolean m_active;
  private volatile boolean m_isStopping;
  private int m_exitCode = 0;
  // model
  private String m_id;
  private IDesktop m_desktop;
  private VirtualDesktop m_virtualDesktop;
  private Subject m_offlineSubject;
  private Subject m_subject;

  /* locked by m_sharedVarLock*/
  private final SharedVariableMap m_sharedVariableMap;
  private CountDownLatch m_sharedVarsInitialized = new CountDownLatch(1);
  private final Object m_sharedVarLock = new Object();

  private IMemoryPolicy m_memoryPolicy;
  private final Map<String, Object> m_clientSessionData;
  private ScoutTexts m_scoutTexts;
  private UserAgent m_userAgent;
  private final ObjectExtensions<AbstractClientSession, IClientSessionExtension<? extends AbstractClientSession>> m_objectExtensions;
  private URI m_browserUri;

  public AbstractClientSession(boolean autoInitConfig) {
    m_eventListeners = new EventListenerList();
    m_clientSessionData = new HashMap<String, Object>();
    m_stateLock = new Object();
    m_isStopping = false;
    m_userAgent = UserAgent.get();
    m_subject = Subject.getSubject(AccessController.getContext());
    m_objectExtensions = new ObjectExtensions<AbstractClientSession, IClientSessionExtension<? extends AbstractClientSession>>(this);
    m_scoutTexts = new ScoutTexts();

    synchronized (m_sharedVarLock) {
      m_sharedVariableMap = new SharedVariableMap();
    }

    setLocale(NlsLocale.get()); // TODO [cgu] This is not every transparent. Change this please.

    if (autoInitConfig) {
      interceptInitConfig();
    }
  }

  @Override
  public final List<? extends IClientSessionExtension<? extends AbstractClientSession>> getAllExtensions() {
    return m_objectExtensions.getAllExtensions();
  }

  @Override
  public <T extends IExtension<?>> T getExtension(Class<T> c) {
    return m_objectExtensions.getExtension(c);
  }

  protected IClientSessionExtension<? extends AbstractClientSession> createLocalExtension() {
    return new LocalClientSessionExtension<AbstractClientSession>(this);
  }

  protected final void interceptInitConfig() {
    m_objectExtensions.initConfig(createLocalExtension(), new Runnable() {
      @Override
      public void run() {
        initConfig();
      }
    });
  }

  @ConfigProperty(ConfigProperty.BOOLEAN)
  @Order(100)
  protected boolean getConfiguredSingleThreadSession() {
    return false;
  }

  @Override
  public String getId() {
    return m_id;
  }

  /**
   * Returns the userId of the subject holding the current session
   */
  @Override
  public String getUserId() {
    return getSharedContextVariable("userId", String.class);
  }

  /**
   * Returns the {@link ScoutTexts} instance assigned to the type (class) of the current ClientSession.
   * <p>
   * Override this method to set the application specific texts implementation
   * </p>
   */
  @Override
  public ScoutTexts getTexts() {
    return m_scoutTexts;
  }

  @Override
  public final Locale getLocale() {
    return (Locale) propertySupport.getProperty(PROP_LOCALE);
  }

  @Override
  public final void setLocale(Locale locale) {
    propertySupport.setProperty(PROP_LOCALE, locale);
    NlsLocale.set(locale); // TODO [cgu] This is not every transparent. Change this please.
  }

  @Override
  public UserAgent getUserAgent() {
    if (m_userAgent == null) {
      m_userAgent = UserAgent.createDefault();
      LOG.warn("UserAgent not set; using default [default={}]", m_userAgent);
    }
    return m_userAgent;
  }

  @Override
  public void setUserAgent(UserAgent userAgent) {
    UserAgent.set(userAgent);
    m_userAgent = userAgent;
  }

  @Override
  public Subject getOfflineSubject() {
    return m_offlineSubject;
  }

  protected void setOfflineSubject(Subject offlineSubject) {
    m_offlineSubject = offlineSubject;
  }

  @Override
  public URI getBrowserURI() {
    return m_browserUri;
  }

  @Override
  public boolean isActive() {
    return m_active;
  }

  private void setActive(boolean b) {
    synchronized (m_stateLock) {
      m_active = b;
      m_stateLock.notifyAll();
    }
  }

  @Override
  public Map<String, Object> getSharedVariableMap() {
    synchronized (m_sharedVarLock) {
      return CollectionUtility.copyMap(m_sharedVariableMap);
    }
  }

  /**
   * Do not use this method directly. Create specific (typed) methods instead to access shared variables. (like
   * {@link #getUserId()})
   * <p>
   * Returns the variables shared with the server. Shared variables are automatically updated on the client by client
   * notifications when changed on the server.
   * </p>
   */
  protected <T> T getSharedContextVariable(String name, Class<T> type) {
    Object o;
    synchronized (m_sharedVarLock) {
      o = m_sharedVariableMap.get(name);
    }
    return TypeCastUtility.castValue(o, type);
  }

  @Override
  public final Object getStateLock() {
    return m_stateLock;
  }

  /*
   * Properties
   */

  protected void initConfig() {
    m_virtualDesktop = new VirtualDesktop();
    String memPolicyValue = CONFIG.getPropertyValue(MemoryPolicyProperty.class);
    setMemoryPolicy(memPolicyValue);

    if (PropertyMap.CURRENT.get() != null) {
      String urlText = PropertyMap.CURRENT.get().get("url");
      try {
        m_browserUri = urlText != null ? new URI(urlText) : null;
      }
      catch (URISyntaxException e) {
        LOG.warn("Cannot read browser url: " + urlText, e);
      }
    }
  }

  private void setMemoryPolicy(String policy) {
    if ("small".equals(policy)) {
      setMemoryPolicy(new SmallMemoryPolicy());
    }
    else if ("medium".equals(policy)) {
      setMemoryPolicy(new MediumMemoryPolicy());
    }
    else {
      setMemoryPolicy(new LargeMemoryPolicy());
    }
  }

  /**
   * replace the shared variable map with a new version.
   *
   * @param newMap
   */
  @Override
  public void replaceSharedVariableMapInternal(SharedVariableMap newMap) {
    synchronized (m_sharedVarLock) {
      m_sharedVariableMap.updateInternal(newMap);
    }
    m_sharedVarsInitialized.countDown();
  }

  /**
   * Pings the server to get the initial shared variables. Blocks until the initial version of the shared variables is
   * available or the timeout is reached.
   *
   * @param timeout
   *          the maximum time to wait
   * @param unit
   *          the time unit of the {@code timeout} argument
   * @throws ProcessingException
   *           if interrupted (and the variables are not initialized)
   */
  protected void initializeSharedVariables(long timeout, TimeUnit unit) {
    BEANS.get(IPingService.class).ping("");
    awaitSharedVariablesInitialized(timeout, unit);
  }

  /**
   * Wait until the shared variables are initialized by a notification from the server
   *
   * @throws ProcessingException
   *           if interrupted (and the variables are not initialized)
   */
  protected void awaitSharedVariablesInitialized(long timeout, TimeUnit unit) {
    try {
      if (LOG.isDebugEnabled()) {
        LOG.debug("Awaiting shared variable map");
      }
      m_sharedVarsInitialized.await(timeout, unit);
      if (LOG.isDebugEnabled()) {
        LOG.debug("Shared variables updated");
      }
    }
    catch (InterruptedException e) {
      throw new ProcessingException("Error waiting for initialized shared variables", e);
    }
  }

  @Override
  public void start(String sessionId) {
    Assertions.assertNotNull(sessionId, "Session id must not be null");
    if (isActive()) {
      throw new IllegalStateException("session is active");
    }
    m_id = sessionId;
    interceptLoadSession();
    setActive(true);

    fireSessionChangedEvent(new SessionEvent(this, SessionEvent.TYPE_STARTED));
    LOG.info("Client session started [session={}, user={}]", this, getUserId());
  }

  /**
   * Initialize the properties of the client session. This method is called in the process of the initialization right
   * before the session is activated.
   */
  @ConfigOperation
  @Order(10)
  protected void execLoadSession() {
  }

  /**
   * This method is called just before the session is stopped and can be overwritten to persist properties of the client
   * session
   */
  @ConfigOperation
  @Order(20)
  protected void execStoreSession() {
  }

  @SuppressWarnings("deprecation")
  @Override
  public IDesktop getVirtualDesktop() {
    return getDesktopElseVirtualDesktop();
  }

  @Override
  public IDesktop getDesktop() {
    return m_desktop;
  }

  @Override
  public IDesktop getDesktopElseVirtualDesktop() {
    return m_desktop != null ? m_desktop : m_virtualDesktop;
  }

  @Override
  public void setDesktop(IDesktop a) {
    if (a == null) {
      throw new IllegalArgumentException("argument must not be null");
    }
    if (m_desktop != null) {
      throw new IllegalStateException("desktop is active");
    }
    m_desktop = a;
    if (m_desktop != null) {
      if (m_virtualDesktop != null) {
        for (DesktopListener listener : m_virtualDesktop.getDesktopListeners()) {
          m_desktop.addDesktopListener(listener);
        }
        for (Map.Entry<String, EventListenerList> e : m_virtualDesktop.getPropertyChangeListenerMap().entrySet()) {
          String propName = e.getKey();
          EventListenerList list = e.getValue();
          if (propName == null) {
            for (PropertyChangeListener listener : list.getListeners(PropertyChangeListener.class)) {
              m_desktop.addPropertyChangeListener(listener);
            }
          }
          else {
            for (PropertyChangeListener listener : list.getListeners(PropertyChangeListener.class)) {
              m_desktop.addPropertyChangeListener(propName, listener);
            }
          }
        }
        for (Map.Entry<Object, EventListenerList> e : m_virtualDesktop.getDataChangeListenerMap().entrySet()) {
          Object dataType = e.getKey();
          EventListenerList list = e.getValue();
          if (dataType == null) {
            for (DataChangeListener listener : list.getListeners(DataChangeListener.class)) {
              m_desktop.addDataChangeListener(listener);
            }
          }
          else {
            for (DataChangeListener listener : list.getListeners(DataChangeListener.class)) {
              m_desktop.addDataChangeListener(listener, dataType);
            }
          }
        }
        m_virtualDesktop = null;
      }
      m_desktop.initDesktop();
    }
    else {
      m_virtualDesktop = new VirtualDesktop();
    }
  }

  /**
   * Close the session
   */
  @Override
  public void stop() {
    stop(m_exitCode);
  }

  @Override
  public void stop(int exitCode) {
    synchronized (m_stateLock) {
      if (isStopping()) {
        // we are already stopping. ignore event
        return;
      }
      m_isStopping = true;
    }

    if (!m_desktop.doBeforeClosingInternal()) {
      m_isStopping = false;
      return;
    }
    m_exitCode = exitCode;

    try {
      interceptStoreSession();
    }
    catch (Exception t) {
      LOG.error("Failed to store the client session.", t);
    }

    if (m_desktop != null) {
      try {
        m_desktop.closeInternal();
      }
      catch (Exception t) {
        LOG.error("Failed to close the desktop.", t);
      }
      m_desktop = null;
    }

    // Wait for running jobs to complete prior shutdown the session.
    try {
      long delay = NumberUtility.nvl(CONFIG.getPropertyValue(JobCompletionDelayOnSessionShutdown.class), 0L);
      if (delay > 0L) {
        final Filter runningJobsFilter = Jobs.newFutureFilter().andMatchAnyFuture(findRunningJobs());
        Jobs.getJobManager().awaitDone(runningJobsFilter, delay, TimeUnit.SECONDS);
      }
      cancelRunningJobs();
    }
    catch (RuntimeException e) {
      LOG.warn("Encountered an error while waiting for running jobs to complete.", e);
    }
    finally {
      inactivateSession();
    }
  }

  protected void inactivateSession() {
    try {
      ILogoutService logoutService = BEANS.opt(ILogoutService.class);
      if (logoutService != null) {
        logoutService.logout();
      }
    }
    finally {
      setActive(false);
    }

    fireSessionChangedEvent(new SessionEvent(this, SessionEvent.TYPE_STOPPED));
    LOG.info("Client session stopped [session={}, user={}]", this, getUserId());
  }

  /**
   * Check if any jobs are currently running, that are different from the current job, have the same session assigned
   * and are not blocked. If yes, a warning with the list of found jobs is printed to the logger.
   */
  protected void cancelRunningJobs() {
    final List<IFuture<?>> runningJobs = findRunningJobs();
    if (!runningJobs.isEmpty()) {
      Jobs.getJobManager().cancel(Jobs.newFutureFilter().andMatchAnyFuture(runningJobs), true);

      LOG.warn("Some running client jobs found while stopping the client session; sent a cancellation request to release associated worker threads. "
          + "[session={}, user={}, jobs=(see next line)]\n{}",
          new Object[]{AbstractClientSession.this, getUserId(), CollectionUtility.format(runningJobs, "\n")});
    }
  }

  /**
   * Returns all the jobs which currently are running.
   */
  protected List<IFuture<?>> findRunningJobs() {
    CollectorVisitor<IFuture<?>> collector = new CollectorVisitor<>();
    Jobs.getJobManager().visit(ClientJobs.newFutureFilter().andMatchNotCurrentFuture().andMatchCurrentSession(), collector);
    return collector.getElements();
  }

  @Override
  public boolean isStopping() {
    return m_isStopping;
  }

  @Override
  public int getExitCode() {
    return m_exitCode;
  }

  @Override
  public IMemoryPolicy getMemoryPolicy() {
    return m_memoryPolicy;
  }

  @Override
  public void setMemoryPolicy(IMemoryPolicy p) {
    if (m_memoryPolicy != null) {
      m_memoryPolicy.removeNotify();
    }
    m_memoryPolicy = p;
    if (m_memoryPolicy != null) {
      m_memoryPolicy.addNotify();
    }
  }

  public void goOnline() {
    if (OfflineState.isOfflineDefault()) {
      OfflineState.setOfflineDefault(false);
    }
  }

  @Override
  public void goOffline() {
    final String keyName = "offline.user";
    IPreferences pref = ClientUIPreferences.getClientPreferences(this);
    if (getUserId() != null && OfflineState.isOnlineDefault() && pref != null) {
      pref.put(keyName, getUserId());
    }

    // create new backend subject
    String offlineUser = null;
    if (pref != null) {
      offlineUser = pref.get(keyName, null);
    }
    if (offlineUser == null) {
      offlineUser = getUserId();
      if (offlineUser == null) {
        offlineUser = "anonymous";
      }
    }

    m_offlineSubject = new Subject();
    m_offlineSubject.getPrincipals().add(new SimplePrincipal(offlineUser));
    OfflineState.setOfflineDefault(true);
  }

  @Override
  public Subject getSubject() {
    return m_subject;
  }

  @Override
  public void setSubject(Subject subject) {
    m_subject = subject;
  }

  @Override
  public void setData(String key, Object data) {
    if (data == null) {
      m_clientSessionData.remove(key);
    }
    else {
      m_clientSessionData.put(key, data);
    }
  }

  @Override
  public Object getData(String key) {
    return m_clientSessionData.get(key);
  }

  /**
   * The extension delegating to the local methods. This Extension is always at the end of the chain and will not call
   * any further chain elements.
   */
  protected static class LocalClientSessionExtension<OWNER extends AbstractClientSession> extends AbstractExtension<OWNER> implements IClientSessionExtension<OWNER> {

    public LocalClientSessionExtension(OWNER owner) {
      super(owner);
    }

    @Override
    public void execStoreSession(ClientSessionStoreSessionChain chain) {
      getOwner().execStoreSession();
    }

    @Override
    public void execLoadSession(ClientSessionLoadSessionChain chain) {
      getOwner().execLoadSession();
    }

  }

  protected final void interceptStoreSession() {
    List<? extends IClientSessionExtension<? extends AbstractClientSession>> extensions = getAllExtensions();
    ClientSessionStoreSessionChain chain = new ClientSessionStoreSessionChain(extensions);
    chain.execStoreSession();
  }

  protected final void interceptLoadSession() {
    List<? extends IClientSessionExtension<? extends AbstractClientSession>> extensions = getAllExtensions();
    ClientSessionLoadSessionChain chain = new ClientSessionLoadSessionChain(extensions);
    chain.execLoadSession();
  }

  @Override
  public void addListener(ISessionListener sessionListener) {
    m_eventListeners.add(ISessionListener.class, sessionListener);
  }

  @Override
  public void removeListener(ISessionListener sessionListener) {
    m_eventListeners.remove(ISessionListener.class, sessionListener);
  }

  @Internal
  protected void fireSessionChangedEvent(final SessionEvent event) {
    List<ISessionListener> listeners = new ArrayList<>();
    listeners.addAll(Arrays.asList(m_eventListeners.getListeners(ISessionListener.class))); // session specific listeners
    listeners.addAll(BEANS.all(IGlobalSessionListener.class)); // global listeners
    for (final ISessionListener listener : listeners) {
      try {
        listener.sessionChanged(event);
      }
      catch (final Exception e) {
        LOG.error("Failed to notify listener about session state change", e);
      }
    }
  }

  @Override
  public String toString() {
    return super.toString() + "[id = " + getId() + "]";
  }
}
