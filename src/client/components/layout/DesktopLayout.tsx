import * as React from 'react';
import {
  LuBell,
  LuSquareActivity,
  LuChartArea,
  LuCompass,
  LuFileChartPie,
  LuMonitorDot,
  LuServer,
  LuWifi,
  LuTabletSmartphone,
  LuBrainCircuit,
  LuSquareFunction,
  LuLink,
  LuRoute,
  LuPanelsTopLeft,
} from 'react-icons/lu';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useLocalStorageState } from 'ahooks';
import { cn } from '@/utils/style';
import { Separator } from '@/components/ui/separator';
import { Nav } from './Nav';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { UserConfig } from './UserConfig';
import { Outlet } from '@tanstack/react-router';
import { trpc } from '@/api/trpc';
import { useCurrentWorkspaceId } from '@/store/user';
import { LayoutProps } from './types';
import { useTranslation } from '@i18next-toolkit/react';
import { CommandPanel } from '@/components/CommandPanel';
import { RiSurveyLine } from 'react-icons/ri';
import { WorkspacePauseTip } from '../workspace/WorkspacePauseTip';
import { DevContainer } from '../DevContainer';
import { AIPanel } from '../ai/AIPanel';
import { compact } from 'lodash-es';
import { useGlobalConfig } from '@/hooks/useConfig';
import { useSettingsStore } from '@/store/settings';

const defaultLayout: [number, number, number] = [15, 25, 60];

export const DesktopLayout: React.FC<LayoutProps> = React.memo((props) => {
  const [layout = defaultLayout, setLayout] = useLocalStorageState(
    'react-resizable-panels:layout',
    { defaultValue: defaultLayout }
  );
  const [isCollapsed = false, setIsCollapsed] = useLocalStorageState<boolean>(
    'react-resizable-panels:collapsed',
    {
      defaultValue: false,
    }
  );
  const workspaceId = useCurrentWorkspaceId();
  const { data: serviceCount } = trpc.workspace.getServiceCount.useQuery(
    {
      workspaceId: workspaceId!,
    },
    {
      enabled: !!workspaceId,
    }
  );
  const { data: notifications = [] } = trpc.notification.all.useQuery(
    {
      workspaceId: workspaceId!,
    },
    {
      enabled: !!workspaceId,
    }
  );
  const { t } = useTranslation();
  const { alphaMode: serverAlphaMode, enableFunctionWorker } =
    useGlobalConfig();
  const alphaMode = useSettingsStore((state) => state.alphaMode);

  const navbar = (
    <>
      <div
        className={cn(
          'flex h-[52px] items-center gap-2.5 px-3',
          isCollapsed && 'justify-center px-0'
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-amber-500/15 to-amber-500/5 ring-1 ring-amber-500/25 shadow-sm shadow-amber-500/5">
          <img
            className="h-6 w-6 drop-shadow-sm"
            src="/icon.png"
            alt="TFG Monitor"
          />
        </div>
        {!isCollapsed && (
          <div className="flex flex-1 items-center justify-between min-w-0">
            <span className="truncate font-bold tracking-tight text-foreground text-sm">
              TFG Monitor
            </span>
          </div>
        )}
      </div>
      <Separator />
      <div
        className={cn(
          'flex h-[48px] items-center justify-center',
          isCollapsed ? 'h-[48px]' : 'px-2'
        )}
      >
        <WorkspaceSwitcher isCollapsed={isCollapsed} />
      </div>
      <Separator />
      <div className="p-2">
        <CommandPanel isCollapsed={isCollapsed} />
      </div>
      <Separator />

      <Nav
        isCollapsed={isCollapsed}
        links={compact([
          {
            title: t('Monitor'),
            label: String(serviceCount?.monitor ?? ''),
            icon: LuMonitorDot,
            to: '/monitor',
          },
          {
            title: t('Notifications'),
            label: notifications.length > 0 ? String(notifications.length) : '',
            icon: LuBell,
            to: '/settings/notifications',
          },
          {
            title: t('Feed'),
            label: String(serviceCount?.feed ?? ''),
            icon: LuSquareActivity,
            to: '/feed',
          },
          {
            title: t('Website'),
            label: String(serviceCount?.website ?? ''),
            icon: LuChartArea,
            to: '/website',
          },
          {
            title: t('Servers'),
            label: String(serviceCount?.server ?? ''),
            icon: LuServer,
            to: '/server',
          },
          {
            title: t('Pages'),
            label: String(serviceCount?.page ?? ''),
            icon: LuFileChartPie,
            to: '/page',
          },
          {
            title: t('Insights'),
            icon: LuCompass,
            to: '/insights',
          },
        ])}
      />

      {alphaMode && (
        <>
          <Separator />
          <DevContainer>
            <Nav
              isCollapsed={isCollapsed}
              links={compact([
                {
                  title: t('Application'),
                  label: String(serviceCount?.application ?? ''),
                  icon: LuTabletSmartphone,
                  to: '/application',
                },
                {
                  title: t('Telemetry'),
                  label: String(serviceCount?.telemetry ?? ''),
                  icon: LuWifi,
                  to: '/telemetry',
                },
                {
                  title: t('Survey'),
                  label: String(serviceCount?.survey ?? ''),
                  icon: RiSurveyLine,
                  to: '/survey',
                },
                {
                  title: t('Short Link'),
                  label: String(serviceCount?.shortLink ?? ''),
                  icon: LuLink,
                  to: '/shortlink',
                },
                {
                  title: 'Artifacts',
                  icon: LuPanelsTopLeft,
                  to: '/artifacts',
                },
                {
                  title: t('AI Gateway'),
                  label: String(serviceCount?.aiGateway ?? ''),
                  icon: LuBrainCircuit,
                  to: '/aiGateway',
                },
                {
                  title: t('AI Router'),
                  label: String(serviceCount?.aiRouter ?? ''),
                  icon: LuRoute,
                  to: '/aiRouter',
                },
                serverAlphaMode &&
                  enableFunctionWorker && {
                    title: t('Function'),
                    label: String(serviceCount?.functionWorker ?? ''),
                    icon: LuSquareFunction,
                    to: '/worker',
                  },
              ])}
            />
          </DevContainer>
        </>
      )}

      <div className="flex-1" />

      <Separator />

      <div className={cn(isCollapsed && 'm-auto')}>
        <UserConfig isCollapsed={isCollapsed} />
      </div>
    </>
  );

  return (
    <div className="flex h-full w-full flex-col">
      <WorkspacePauseTip />
      {alphaMode && <AIPanel />}

      <ResizablePanelGroup
        className="flex-1 items-stretch"
        direction="horizontal"
        onLayout={(sizes: number[]) => {
          if (sizes.length === 3) {
            setLayout(sizes as typeof defaultLayout);
          } else if (sizes.length === 2) {
            const listSize = layout[1];
            const rest = 100 - sizes[0] - listSize;
            setLayout([sizes[0], listSize, rest]);
          }
        }}
      >
        <ResizablePanel
          defaultSize={layout[0]}
          collapsedSize={1}
          collapsible={true}
          minSize={10}
          maxSize={20}
          onCollapse={() => {
            setIsCollapsed(true);
          }}
          onExpand={() => {
            setIsCollapsed(false);
          }}
          className={cn(
            'flex flex-col',
            isCollapsed &&
              'min-w-[50px] transition-all duration-300 ease-in-out'
          )}
        >
          {navbar}
        </ResizablePanel>

        {props.list && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={layout[1]} minSize={20}>
              <div className="h-full overflow-hidden">{props.list}</div>
            </ResizablePanel>
          </>
        )}

        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize={props.list ? layout[2] : layout[1] + layout[2]}
        >
          <div className="h-full overflow-hidden">
            {props.children ?? <Outlet />}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
});
DesktopLayout.displayName = 'DesktopLayout';
