/**
 * Small helpers shared by the static pages.
 */

/**
 * Email links are written as data-mail="user|domain" and only turned into a
 * real address in the browser, so simple spam bots reading the page don't find it.
 * With data-mail-text the link text becomes the address too.
 */
export function wireMailLinks(root = document) {
  for (const a of root.querySelectorAll('a[data-mail]')) {
    const [user, domain] = a.dataset.mail.split('|');
    const address = `${user}@${domain}`;
    a.href = `mailto:${address}`;
    if (a.hasAttribute('data-mail-text')) a.textContent = address;
  }
}
