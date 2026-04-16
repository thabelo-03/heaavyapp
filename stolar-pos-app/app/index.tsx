import { Redirect } from 'expo-router';
import React from 'react';

/**
 * This is the entry point for the app.
 * It should redirect to the main login screen in the (auth) group.
 * Having a separate entry file like this prevents session-checking logic
 * from interfering with the main login component and causing redirection bugs.
 */
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}