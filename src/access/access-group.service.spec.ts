import { mediaScopedSlug } from './access-group.service';

describe('mediaScopedSlug', () => {
  it('adiciona o prefixo de video ao slug legado', () => {
    expect(mediaScopedSlug('grupo-a', 'video')).toBe('video-grupo-a');
  });

  it('preserva os slugs que ja possuem prefixo', () => {
    expect(mediaScopedSlug('video-grupo-a', 'video')).toBe('video-grupo-a');
    expect(mediaScopedSlug('audio-grupo-a', 'video')).toBe('audio-grupo-a');
  });
});
