import { opendir } from 'node:fs/promises';

try {
  const dir = await opendir('./tmp');
  for await (const dirent of dir)
    console.log(dirent);
} catch (err) {
  console.error(err);
}
