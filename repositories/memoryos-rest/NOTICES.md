# Runtime and dependency notices

The adapter installs zero external production and development npm packages.
Node.js 24.21.0 and npm 11.19.0 are external operator-supplied tools, not bundled
inside this package. The exact Node executable and official signed distribution
are verified by the engineering review and trusted launcher. npm's primary
license is Artistic-2.0; its own dependencies retain their respective terms.

The full unmodified upstream Node LICENSE is notices/node-LICENSE.txt. Its
primary Node grant is MIT, while embedded component grants differ: OpenSSL and
simdjson use Apache-2.0, ICU uses Unicode-3.0 plus its retained nested notices,
V8 and zstd have BSD-3-Clause primary terms, and zlib uses Zlib. Other listed
components include Acorn, c-ares, merve, amaro, libuv, llhttp, undici, simdutf,
ada, nghttp2, brotli and uvwasi with their preserved MIT primary grants. Those
labels do not replace complete copyright notices or nested component terms.

The SPDX 2.3 document records actual nonempty runtime component versions and
external npm. ABI identifiers modules/napi and ICU data versions are retained
as runtime metadata in dependency-manifest.json, not invented software packages.
Empty nghttp3/ngtcp2 version entries do not claim installed components.

License conclusions remain NOASSERTION where complete component-level rights
are not independently established, including first-party MemoryOS sources and
SQLite/internal helper version records. This is a deliberate scope statement,
not a claim that those files are unlicensed or that all components are MIT.
The review binds the full notice bytes and actual executable/closure identities.
