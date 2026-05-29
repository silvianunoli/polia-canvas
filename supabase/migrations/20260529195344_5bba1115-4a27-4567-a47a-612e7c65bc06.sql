-- Auto-popular conquistas quando uma tarefa floresce (status = 'feito')
-- e quando uma etapa fecha (star_N_completed_at preenchido).

-- 1) Trigger em tarefas: status muda para 'feito'
CREATE OR REPLACE FUNCTION public.fn_conquista_tarefa_florescer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'feito' AND (OLD.status IS DISTINCT FROM 'feito') THEN
    INSERT INTO public.conquistas (user_id, titulo, descricao, tipo, xp)
    VALUES (
      NEW.user_id,
      'tarefa floresceu',
      COALESCE(NEW.titulo, 'uma tarefa virou conquista'),
      'tarefa',
      10
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conquista_tarefa_florescer ON public.tarefas;
CREATE TRIGGER trg_conquista_tarefa_florescer
AFTER UPDATE ON public.tarefas
FOR EACH ROW
EXECUTE FUNCTION public.fn_conquista_tarefa_florescer();

-- 2) Trigger em profiles: alguma star_N_completed_at virou not null
CREATE OR REPLACE FUNCTION public.fn_conquista_etapa_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  etapa_num int;
  col_old timestamptz;
  col_new timestamptz;
BEGIN
  FOR etapa_num IN 1..11 LOOP
    EXECUTE format('SELECT ($1).star_%s_completed_at, ($2).star_%s_completed_at', etapa_num, etapa_num)
      INTO col_old, col_new
      USING OLD, NEW;
    IF col_new IS NOT NULL AND col_old IS NULL THEN
      INSERT INTO public.conquistas (user_id, titulo, descricao, tipo, xp)
      VALUES (
        NEW.id,
        'etapa ' || etapa_num || ' fechada',
        'mais uma estrela acesa na sua constelação',
        'etapa',
        50
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conquista_etapa_fechada ON public.profiles;
CREATE TRIGGER trg_conquista_etapa_fechada
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_conquista_etapa_fechada();