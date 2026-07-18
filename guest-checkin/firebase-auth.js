(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyBLXwvUvCkKfEhXXITJQs1HXxm8pjgVRiA",
    authDomain: "guest-checkin-542d6.firebaseapp.com",
    projectId: "guest-checkin-542d6",
    storageBucket: "guest-checkin-542d6.firebasestorage.app",
    messagingSenderId: "325529516329",
    appId: "1:325529516329:web:099f7deac9a6e6fc951f38",
    measurementId: "G-HP61P2YC9Q",
  };

  const primaryApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  const auth = primaryApp.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
  auth.useDeviceLanguage();

  async function readJson(response) {
    const text = await response.text();

    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { error: text || "Unexpected response" };
    }
  }

  function normalizeFirebaseError(error, fallbackMessage) {
    const code = typeof error?.code === "string" ? error.code : "";
    const message = typeof error?.message === "string" ? error.message : fallbackMessage;
    const combined = code ? `${code}: ${message}` : message;
    return new Error(combined || fallbackMessage);
  }

  async function createBackendSession(user, forceRefresh = false) {
    if (!user) {
      throw new Error("No Firebase user is signed in.");
    }

    const idToken = await user.getIdToken(forceRefresh);
    const response = await fetch("/api/auth/firebase-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id_token: idToken,
      }),
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(data.error || "Unable to create app session.");
    }
    return data;
  }

  async function signIn(email, password) {
    try {
      const credential = await auth.signInWithEmailAndPassword(String(email || "").trim(), password);
      return createBackendSession(credential.user, true);
    } catch (error) {
      throw normalizeFirebaseError(error, "Unable to sign in.");
    }
  }

  async function signUpPrimary(email, password, displayName = "") {
    try {
      const credential = await auth.createUserWithEmailAndPassword(String(email || "").trim(), password);
      if (displayName && credential.user) {
        await credential.user.updateProfile({ displayName });
      }
      return createBackendSession(credential.user, true);
    } catch (error) {
      throw normalizeFirebaseError(error, "Unable to create Firebase account.");
    }
  }

  async function ensureAppSession() {
    if (!auth.currentUser) {
      return null;
    }
    return createBackendSession(auth.currentUser, false);
  }

  async function changePassword(currentPassword, newPassword) {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error("No Firebase user is signed in.");
    }

    try {
      const credential = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await auth.currentUser.reauthenticateWithCredential(credential);
      await auth.currentUser.updatePassword(newPassword);
      return { ok: true };
    } catch (error) {
      throw normalizeFirebaseError(error, "Unable to change password.");
    }
  }

  async function sendPasswordReset(email) {
    try {
      await auth.sendPasswordResetEmail(String(email || "").trim(), {
        url: "https://checkin.hotelsinalibaug.in/super-admin-home.html",
        handleCodeInApp: false,
      });
      return { ok: true };
    } catch (error) {
      throw normalizeFirebaseError(error, "Unable to send password reset email.");
    }
  }

  async function signOutEverywhere() {
    await auth.signOut();
    await fetch("/api/auth/logout", { method: "POST" });
  }

  async function createUserInFirebase(email, password, displayName = "") {
    const appName = `hia-user-${Date.now()}`;
    const secondaryApp = firebase.initializeApp(firebaseConfig, appName);
    const secondaryAuth = secondaryApp.auth();

    try {
      const credential = await secondaryAuth.createUserWithEmailAndPassword(String(email || "").trim(), password);
      if (displayName && credential.user) {
        await credential.user.updateProfile({ displayName });
      }

      const createdUser = credential.user;
      const payload = {
        uid: createdUser.uid,
        email: createdUser.email || String(email || "").trim(),
        display_name: createdUser.displayName || displayName || String(email || "").trim(),
      };

      await secondaryAuth.signOut();
      return payload;
    } catch (error) {
      throw normalizeFirebaseError(error, "Unable to create Firebase user.");
    } finally {
      await secondaryApp.delete().catch(() => {});
    }
  }

  window.firebaseAuthBridge = {
    auth,
    signIn,
    signUpPrimary,
    ensureAppSession,
    changePassword,
    sendPasswordReset,
    signOutEverywhere,
    createUserInFirebase,
  };
})();
