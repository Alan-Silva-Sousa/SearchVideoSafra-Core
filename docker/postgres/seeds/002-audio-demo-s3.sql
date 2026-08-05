WITH demo_recordings AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY id) AS position
    FROM public.gravacoes
    WHERE referencia_audio = 'https://www.w3schools.com/html/horse.mp3'
)
UPDATE public.gravacoes AS recording
SET referencia_audio = CASE
    WHEN demo.position % 2 = 0
        THEN 'desenvolvimento/audios/audio-teste2.m4a'
    ELSE 'desenvolvimento/audios/audio-teste.m4a'
END
FROM demo_recordings AS demo
WHERE recording.id = demo.id;
