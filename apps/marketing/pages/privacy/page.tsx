import { Legal } from '../../components/Legal'
import { REPOSITORY } from '../../shell/Header'

export default function Privacy() {
  return (
    <Legal page="privacy" title="Privacy" updated="10 October 2026">
      <p>
        Enclose is an open-source project maintained by Glauber. This page says what the
        Enclose app and this website send anywhere, and what they do not. In short: the app
        needs no account, your projects stay on your Mac, and the installed app counts how
        it is used, without your name, unless you switch that off.
      </p>

      <h2>Usage data from the app</h2>
      <p>
        The installed app counts how it is used, so that what is worked on next is what
        people use, and sends that count to <a href="https://posthog.com">PostHog</a>. Run
        from a checkout of the source, it sends nothing.
      </p>
      <p>What is counted, each as an event with a few words and numbers:</p>
      <ul>
        <li>that the app was opened;</li>
        <li>
          that a project was added or removed, and whether it was new, an example, CAD files
          or a folder;
        </li>
        <li>
          that a message was sent: the agent, its model, the effort and the permissions, and
          how many parts and pictures went with it;
        </li>
        <li>that a model was looked over, a change turned back, or a model saved;</li>
        <li>
          which features the view was put into (a section, the exploded view, the blueprint,
          a reference scene, a project’s own tools), once for a run of the app;
        </li>
        <li>that an agent was switched on or off, and that an update was fetched.</li>
      </ul>
      <p>
        With every event go the app’s version, your macOS version, the kind of processor,
        and a random name made up for your installation the first time the app runs. That
        name is tied to no account and to nothing else about you. PostHog keeps what it is
        sent in the United States. As any server does, it sees the address a request comes
        from, and works out roughly where that is: a country and a city.
      </p>
      <p>
        Nothing of a project is sent: not its name, its files, or where it is kept. Nothing
        said in a message or in an answer to one. Nothing of what a part, a group or a
        conversation is called.{' '}
        <a href={`${REPOSITORY}/blob/main/docs/usage-data.md`}>The full list</a> is with the
        app’s documentation.
      </p>
      <p>
        To switch it off: Settings, General, Usage data. Switched off, nothing more is
        counted, and what was waiting to be sent is not sent. The name made up for your
        installation is in <code>analytics-id</code>, in{' '}
        <code>~/Library/Application Support/Enclose</code>. Delete it and the app makes up
        another the next time it has something to send.
      </p>

      <h2>What goes to an agent’s provider</h2>
      <p>
        The app works through a coding agent you installed and signed in to yourself: Claude
        Code, Codex or Grok. What you write, the pictures you attach and the project files
        the agent reads go to that agent’s provider, as they would if you ran the agent in a
        terminal. That is between you and the provider, under its privacy policy and your
        subscription. None of it goes to the Enclose project.
      </p>

      <h2>What the app fetches from GitHub</h2>
      <p>
        The app looks for its newer versions on GitHub and downloads them from there, and
        downloads an example project from there when you ask for one. GitHub sees those
        requests and the address they come from, under{' '}
        <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">
          its own privacy statement
        </a>
        .
      </p>

      <h2>What stays on your Mac</h2>
      <p>
        Your projects, your conversations about them and your settings are kept on your Mac
        and nowhere else. Removing a project from the app forgets what was said about it,
        and leaves its folder.
      </p>

      <h2>This website</h2>
      <p>
        This site sets no cookies and runs no analytics or advertising scripts. Its fonts
        and its pictures are served from the site itself. The host that serves it keeps the
        ordinary logs a web server keeps: the address a request came from, the browser, the
        page asked for, and when.
      </p>
      <p>
        To point its download button at the newest release, the page asks GitHub which one
        that is, from your browser, and the download itself comes from GitHub. GitHub sees
        those requests as it sees the app’s.
      </p>

      <h2>What is not done</h2>
      <p>
        Nothing is sold, nothing is shared for advertising, and nothing you make or say is
        used to train a model by this project. What an agent’s provider does with what you
        send it is in that provider’s own policy.
      </p>

      <h2>Your choices</h2>
      <p>
        The project cannot tell which events came from you: it has no name or account to
        find them by. You can stop them at any time with the switch above, and deleting{' '}
        <code>analytics-id</code> cuts what is sent afterwards off from what was sent before.
        Depending on where you live you may have rights over personal data held about you,
        to see it, correct it or have it deleted. Ask through the contact below.
      </p>

      <h2>Children</h2>
      <p>
        Neither the site nor the app is meant for children under 13, and nothing is
        knowingly collected from them.
      </p>

      <h2>Changes</h2>
      <p>
        This page may be changed as the app does. The newest is always here, with the date
        it was last changed at the top.
      </p>

      <h2>Contact</h2>
      <p>
        Questions go to the project’s <a href={`${REPOSITORY}/issues`}>issues on GitHub</a>.
        If yours should not be written in public, say only that there and the maintainer
        will find another way to hear it.
      </p>
    </Legal>
  )
}
