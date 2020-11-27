/* global bugsnagClient */

export const report = {
  error(err) {
    bugsnagClient.notify(err, { severity: 'error' });
  },
  warn(err) {
    bugsnagClient.notify(err, { severity: 'warn' });
  },
  info(err) {
    bugsnagClient.notify(err, { severity: 'info' });
  }
};

const UNITS = [
  [18, 'E'],
  [15, 'P'],
  [12, 'T'],
  [9, 'G'],
  [6, 'M'],
  [3, 'k'],
  [0, ''],
  [-3, 'm'],
  [-6, '\xb5'],
  [-9, 'n'],
  [-12, 'p'],
  [-15, 'f'],
  [-18, 'a']
];

export function human(v, suffix = '', sig = 0) {
  const { pow, log10, floor, round } = Math;
  let exp = floor(log10(v));
  const unit = UNITS.find(([n]) => n <= exp);

  if (!unit) return `0${suffix}`;

  v /= pow(10, unit[0]);
  exp = floor(log10(v)) + 1;
  v = exp < sig ? round(v * pow(10, sig - exp)) / pow(10, sig - exp) : round(v);

  return `${v}${unit[1]}${suffix}`;
}

/**
 * DOM maniulation methods
 */
export function $(...args) {
  const target = args.length == 2 ? args.shift() : document;
  return target ? ElementSet.from(target.querySelectorAll(...args)) : new ElementSet();
}

class ElementSet extends Array {
  on(...args) {
    const els = [...this];

    for (const el of els) {
      el.addEventListener(...args);
    }

    return function() {
      for (const el of els) {
        el.removeEventListener(...args);
      }
    };
  }

  clear() {
    return this.forEach(el => (el.innerText = ''));
  }

  remove() {
    return this.forEach(el => el.remove());
  }

  contains(el) {
    return this.find(n => n.contains(el));
  }

  attr(k, v) {
    if (arguments.length == 1) {
      return this[0]?.getAttribute(k);
    } else if (v === null) {
      this.forEach(el => el.removeAttribute(k));
    } else {
      this.forEach(el => el.setAttribute(k, v));
    }
  }

  get textContent() {
    return this[0]?.textContent;
  }

  set textContent(str) {
    return this.forEach(el => el.textContent = str);
  }

  get innerText() {
    return this[0]?.innerText;
  }

  set innerText(str) {
    return this.forEach(el => el.innerText = str);
  }

  get innerHTML() {
    return this[0]?.innerHTML;
  }

  set innerHTML(str) {
    return this.forEach(el => el.innerHTML = str);
  }

  appendChild(nel) {
    if (typeof (nel) == 'string') nel = document.createTextNode(nel);
    return this.forEach((el, i) => {
      if (i > 0) console.log('CLINGINSL');
      el.appendChild(i > 0 ? nel : nel.cloneNode(true));
    });
  }
}

// Create a new DOM element
$.create = function(name, atts) {
  const el = document.createElement(name);
  if (atts) {
    for (const k in Object.getOwnPropertyNames(atts)) {
      el[k] = atts[k];
    }
  }
  return el;
};

// Find parent or self matching selector (or test function)
$.up = function(el, sel) {
  if (typeof (sel) === 'string') {
    while (el && !el.matches(sel)) el = el.parentElement;
  } else if (typeof (sel) === 'function') {
    while (el && !sel(el)) el = el.parentElement;
  }
  return el;
};

export class AbortError extends Error {}

/**
 * Simple ajax request support.  Supports different HTTP methods, but (for the
 * moment) does not support sending a request body because we don't (yet) need
 * that feature.
 */
export function ajax(method, url, body) {
  let xhr;
  const p = new Promise((resolve, reject) => {
    xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState < 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        const err = new Error(`${xhr.status}: ${url}`);
        err.status = xhr.status;
        err.url = url;
        reject(err);
      }
    };

    xhr.onabort = () => reject(new AbortError('XHR aborted'));

    xhr.open(method, url);

    if (body && typeof (body) != 'string') {
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(body));
    } else if (body) {
      xhr.send(body);
    } else {
      xhr.send();
    }
  });

  p.xhr = xhr;

  return p;
}

export function tagify(type = 'tag', tag) {
  return type + '-' + tag.replace(/\W/g, '_').toLowerCase();
}

export function tagElement(el, type, ...tags) {
  tags = tags.map(String); // Stringify all tags
  tags = tags.filter(t => t).map(t => tagify(type, t));
  el.classList.add(...tags);
}

export function createTag(type, text, count = 0) {
  const el = $.create('div');

  el.classList.add('tag', type);
  el.dataset.tag = tagify(type, text);
  el.title = el.innerText = count < 2 ? text : `${text}(${count})`;

  return el;
}

export function entryFromKey(key) {
  const MODULE_RE = /^(@?[^@]+)(?:@(.*))?$/;

  if (!MODULE_RE.test(key)) console.log('Invalid key', key);

  return RegExp.$2 ? [RegExp.$1, RegExp.$2] : [RegExp.$1];
}

export function getDependencyEntries(pkg, depIncludes, level = 0) {
  pkg = pkg.package || pkg;

  const deps = [];

  for (const type of depIncludes) {
    if (!pkg[type]) continue;

    // Only do one level for non-"dependencies"
    if (level > 0 && type != 'dependencies') continue;

    // Get entries, adding type to each entry
    const d = Object.entries(pkg[type]);
    d.forEach(o => o.push(type));
    deps.push(...d);
  }

  return deps;
}

export function simplur(strings, ...exps) {
  const result = [];
  let n = exps[0];
  let label = n;
  if (Array.isArray(n) && n.length == 2) [n, label] = n;
  for (const s of strings) {
    if (typeof (n) == 'number') {
      result.push(s.replace(/\[([^|]*)\|([^\]]*)\]/g, n == 1 ? '$1' : '$2'));
    } else {
      result.push(s);
    }

    if (!exps.length) break;
    n = label = exps.shift();
    if (Array.isArray(n) && n.length == 2) [n, label] = n;
    result.push(label);
  }

  return result.join('');
}